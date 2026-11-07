import { createServerFn } from "@tanstack/react-start";
import { avg, desc, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import {
	canHearEveryClip,
	hearableRecordings,
} from "~/lib/clip-access.server.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import {
	type CatalogSpecies,
	findCatalogSpeciesBySlug,
} from "~/lib/species-catalog.ts";
import { loadInstalledSpeciesCatalog } from "~/lib/species-control.server.ts";
import { type SpeciesLink, speciesLinkFor } from "~/lib/species-link.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { buildHourActivity, type HourActivity } from "~/lib/stats-data.ts";
import {
	getDetectionYears,
	getMonthlyTrend,
	getYearTrend,
	type TrendPoint,
} from "~/lib/trend.ts";
import { localTimestamp, timestampToMillis } from "~/lib/visits.ts";

export type { HourActivity };

type Visit = {
	date: string;
	time: string;
	confidence: number | null;
	audioUrl?: string | null;
};
export type RecentVisit = Visit & { ageMs: number };

export type BestRecording = {
	date: string;
	time: string;
	confidence: number | null;
	audioUrl: string | null;
};

export type SpeciesDetail = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	speciesLink: SpeciesLink | null;
	totalDetections: number;
	availableYears: number[];
	firstDetected: Visit;
	lastDetected: Visit;
	averageConfidence: number | null;
	history: TrendPoint[];
	detectionTrend: TrendPoint[];
	hourActivity: HourActivity[];
	bestRecording: BestRecording | null;
	recentVisits: RecentVisit[];
	generatedAt: string;
	visitLog: VisitPage;
};

async function resolveDetectedBird(
	slug: string,
): Promise<CatalogSpecies | null> {
	const rows = await db
		.selectDistinct({
			comName: detections.Com_Name,
			sciName: detections.Sci_Name,
		})
		.from(detections);
	return rows.find((row) => comNameToSlug(row.comName) === slug) ?? null;
}

async function resolveComName(slug: string): Promise<string | null> {
	return (await resolveDetectedBird(slug))?.comName ?? null;
}

function byComName(comName: string) {
	return sql`${detections.Com_Name} = ${comName}`;
}

async function getHourActivity(
	filter: ReturnType<typeof byComName>,
): Promise<HourActivity[]> {
	const rows = await db
		.select({
			hour: sql<string>`strftime('%H', ${detections.Time})`,
			count: sql<number>`count(*)`,
		})
		.from(detections)
		.where(filter)
		.groupBy(sql`strftime('%H', ${detections.Time})`);

	return buildHourActivity(
		rows.map((row) => ({ hour: Number(row.hour), count: row.count })),
	);
}

export const VISITS_PAGE_SIZE = 100;

async function getVisitPage(
	comName: string,
	page: number,
	now: Date,
): Promise<RecentVisit[]> {
	const withAudio = await canHearEveryClip();
	const rows = await db
		.select({
			date: detections.Date,
			time: detections.Time,
			confidence: detections.Confidence,
			fileName: detections.File_Name,
		})
		.from(detections)
		.where(byComName(comName))
		.orderBy(desc(detections.Date), desc(detections.Time))
		.limit(VISITS_PAGE_SIZE)
		.offset((page - 1) * VISITS_PAGE_SIZE);

	return rows.map((visit) => ({
		date: visit.date,
		time: visit.time,
		confidence: visit.confidence,
		audioUrl: withAudio
			? audioUrlFor(visit.date, comName, visit.fileName)
			: null,
		ageMs: now.getTime() - timestampToMillis(`${visit.date} ${visit.time}`),
	}));
}

export type VisitPage = {
	page: number;
	visits: RecentVisit[];
	generatedAt: string;
};

export function visitPageCount(total: number): number {
	return Math.max(1, Math.ceil(total / VISITS_PAGE_SIZE));
}

function toPageNumber(page: number): number {
	return Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
}

export const getSpeciesVisits = createServerFn({ method: "GET" })
	.validator(
		z
			.object({ comName: z.string().max(200), page: z.number() })
			.transform(({ comName, page }) => ({
				comName,
				page: toPageNumber(page),
			})),
	)
	.handler(async ({ data: { comName, page } }): Promise<VisitPage> => {
		const now = new Date();
		return {
			page,
			visits: await getVisitPage(comName, page, now),
			generatedAt: localTimestamp(now),
		};
	});

export type SpeciesDetailResult =
	| { status: "detected"; detail: SpeciesDetail }
	| {
			status: "undetected";
			comName: string;
			sciName: string;
			speciesLink: SpeciesLink | null;
	  }
	| { status: "unknown" };

async function resolveCatalogSpecies(
	slug: string,
): Promise<CatalogSpecies | null> {
	try {
		const catalog = await loadInstalledSpeciesCatalog();
		return findCatalogSpeciesBySlug(slug, catalog);
	} catch {
		return null;
	}
}

async function missToResult(slug: string): Promise<SpeciesDetailResult> {
	const known = await resolveCatalogSpecies(slug);
	if (!known) return { status: "unknown" };
	return {
		status: "undetected",
		comName: known.comName,
		sciName: known.sciName,
		speciesLink: speciesLinkFor(known.sciName),
	};
}

export const getBirdIdentity = createServerFn({ method: "GET" })
	.validator(z.string().max(200))
	.handler(
		async ({ data: slug }): Promise<CatalogSpecies | null> =>
			(await resolveDetectedBird(slug)) ?? (await resolveCatalogSpecies(slug)),
	);

export type SpeciesDetailInput = {
	comNameSlug: string;
	year: number;
	visitsPage?: number;
};

export const getSpeciesDetail = createServerFn({ method: "GET" })
	.validator(
		z.object({
			comNameSlug: z.string().max(200),
			year: z.number().int(),
			visitsPage: z.number().int().positive().optional(),
		}) satisfies z.ZodType<SpeciesDetailInput>,
	)
	.handler(
		async ({
			data: { comNameSlug, year, visitsPage = 1 },
		}): Promise<SpeciesDetailResult> => {
			const resolved = await resolveComName(comNameSlug);
			if (!resolved) return missToResult(comNameSlug);

			const filter = byComName(resolved);
			const generatedAtDate = new Date();

			const [totals] = await db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					totalDetections: sql<number>`count(*)`,
					averageConfidence: avg(detections.Confidence),
				})
				.from(detections)
				.where(filter)
				.groupBy(detections.Com_Name, detections.Sci_Name);

			if (!totals || totals.totalDetections === 0) {
				return missToResult(comNameSlug);
			}
			const comName = totals.comName;
			const best = (await hearableRecordings(comName)).get(comName);
			const logPage = Math.min(
				toPageNumber(visitsPage),
				visitPageCount(totals.totalDetections),
			);

			const [
				[first],
				[last],
				recentVisits,
				availableYears,
				history,
				detectionTrend,
				hourActivity,
				logVisits,
			] = await Promise.all([
				db
					.select({
						date: detections.Date,
						time: detections.Time,
						confidence: detections.Confidence,
					})
					.from(detections)
					.where(filter)
					.orderBy(detections.Date, detections.Time)
					.limit(1),
				db
					.select({
						date: detections.Date,
						time: detections.Time,
						confidence: detections.Confidence,
					})
					.from(detections)
					.where(filter)
					.orderBy(desc(detections.Date), desc(detections.Time))
					.limit(1),
				getVisitPage(comName, 1, generatedAtDate),
				getDetectionYears(filter),
				getYearTrend(year, filter),
				getMonthlyTrend(filter),
				getHourActivity(filter),
				logPage === 1 ? null : getVisitPage(comName, logPage, generatedAtDate),
			]);
			const generatedAt = localTimestamp(generatedAtDate);

			const detail: SpeciesDetail = {
				comName,
				sciName: totals.sciName,
				imageUrl: illustrationUrlFor(totals.sciName, "flight"),
				speciesLink: speciesLinkFor(totals.sciName),
				totalDetections: totals.totalDetections,
				availableYears,
				firstDetected: first ?? { date: "", time: "", confidence: null },
				lastDetected: last ?? { date: "", time: "", confidence: null },
				averageConfidence: totals.averageConfidence
					? Number(totals.averageConfidence)
					: null,
				history,
				detectionTrend,
				hourActivity,
				bestRecording: best
					? {
							date: best.date,
							time: best.time,
							confidence: best.confidence,
							audioUrl: audioUrlFor(best.date, comName, best.fileName),
						}
					: null,
				recentVisits,
				generatedAt,
				visitLog: {
					page: logPage,
					visits: logVisits ?? recentVisits,
					generatedAt,
				},
			};

			return { status: "detected", detail };
		},
	);

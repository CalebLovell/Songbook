import { createServerFn } from "@tanstack/react-start";
import { and, avg, count, desc, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import { canHearEveryClip } from "~/lib/clip-access.server.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import {
	countVisits,
	groupVisits,
	localTimestamp,
	timestampToMillis,
	type Visit,
} from "~/lib/visits.ts";

export const detectedAt = sql<string>`datetime(${detections.Date} || ' ' || ${detections.Time})`;
export const isLast24h = sql`${detections.Date} >= date('now', '-1 day', 'localtime') and datetime(${detections.Date} || ' ' || ${detections.Time}) >= datetime('now', '-24 hours', 'localtime')`;

export type NowSummary = {
	detections: number;
};

export type CurrentBird = {
	key: string;
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	detectedAt: string;
	ageMs: number;
	confidence: number | null;
	audioUrl: string | null;
	countLast24h: number;
	visitsLast24h: number;
	averageConfidence: number | null;
	firstHeardLast24h: string | null;
	allTimeCount: number;
};

export type RecentVisit = {
	key: string;
	comName: string;
	sciName: string;
	speciesSlug: string;
	imageUrl: string | null;
	firstAt: string;
	lastAt: string;
	ageMs: number;
	detections: number;
	confidence: number | null;
	audioUrl: string | null;
};

export type NowSnapshot = {
	generatedAt: string;
	current: CurrentBird | null;
	hasAnyDetections: boolean;
	summary: NowSummary;
	recent: RecentVisit[];
};

export const RECENT_LIMIT = 10;

type LatestRow = {
	comName: string;
	sciName: string;
	date: string;
	detectedAt: string;
	confidence: number | null;
	fileName: string;
};

function detectionKey(row: { detectedAt: string; fileName: string }): string {
	return `${row.detectedAt}-${row.fileName}`;
}

async function buildCurrentBird(
	latest: LatestRow,
	generatedAtMs: number,
	withAudio: boolean,
): Promise<CurrentBird> {
	const isSameSpecies = sql`${detections.Com_Name} = ${latest.comName}`;
	// The unary + keeps SQLite off the Com_Name index, so the Date/Time index narrows
	// the window instead of reading every detection of a common bird.
	const inWindowSameSpecies = and(
		isLast24h,
		sql`+${detections.Com_Name} = ${latest.comName}`,
	);

	const [[totals], [allTime], moments, imageUrl] = await Promise.all([
		db
			.select({
				countLast24h: count(),
				firstHeard: sql<
					string | null
				>`min(datetime(${detections.Date} || ' ' || ${detections.Time}))`,
			})
			.from(detections)
			.where(inWindowSameSpecies),
		db
			.select({
				allTimeCount: count(),
				averageConfidence: avg(detections.Confidence),
			})
			.from(detections)
			.where(isSameSpecies),
		db
			.select({ timestamp: detectedAt })
			.from(detections)
			.where(inWindowSameSpecies),
		illustrationUrlFor(latest.sciName, "flight"),
	]);

	return {
		key: detectionKey(latest),
		comName: latest.comName,
		sciName: latest.sciName,
		speciesSlug: comNameToSlug(latest.comName),
		imageUrl,
		detectedAt: latest.detectedAt,
		ageMs: generatedAtMs - timestampToMillis(latest.detectedAt),
		confidence: latest.confidence,
		audioUrl: withAudio
			? audioUrlFor(latest.date, latest.comName, latest.fileName)
			: null,
		countLast24h: totals.countLast24h,
		visitsLast24h: countVisits(moments.map((moment) => moment.timestamp)),
		averageConfidence:
			allTime.averageConfidence != null
				? Number(allTime.averageConfidence)
				: null,
		firstHeardLast24h: totals.firstHeard,
		allTimeCount: allTime.allTimeCount,
	};
}

type WindowRow = LatestRow & { timestamp: string };

const detectionColumns = {
	comName: detections.Com_Name,
	sciName: detections.Sci_Name,
	date: detections.Date,
	detectedAt,
	confidence: detections.Confidence,
	fileName: detections.File_Name,
};

async function getLatestRow(): Promise<LatestRow | undefined> {
	const [latest] = await db
		.select(detectionColumns)
		.from(detections)
		.where(isLast24h)
		.orderBy(desc(detections.Date), desc(detections.Time))
		.limit(1);
	return latest;
}

async function hasAnyDetections(): Promise<boolean> {
	const [row] = await db
		.select({ rowId: sql<number>`rowid` })
		.from(detections)
		.limit(1);
	return row !== undefined;
}

async function getWindowVisits(heroKey: string | undefined) {
	const rows: WindowRow[] = (
		await db.select(detectionColumns).from(detections).where(isLast24h)
	).map((row) => ({ ...row, timestamp: row.detectedAt }));

	const visits = groupVisits(rows);
	const log = visits.filter(
		(visit) =>
			detectionKey(visit.moments[visit.moments.length - 1]) !== heroKey,
	);
	return { rows, visits, log };
}

function buildRecentVisits(
	log: Visit<WindowRow>[],
	generatedAtMs: number,
	withAudio: boolean,
): Promise<RecentVisit[]> {
	return Promise.all(
		log.slice(0, RECENT_LIMIT).map(async (visit) => {
			const first = visit.moments[0];
			const last = visit.moments[visit.moments.length - 1];
			const best = visit.moments.reduce((top, moment) =>
				(moment.confidence ?? -1) > (top.confidence ?? -1) ? moment : top,
			);
			return {
				key: `${visit.comName}-${first.detectedAt}`,
				comName: visit.comName,
				sciName: last.sciName,
				speciesSlug: comNameToSlug(visit.comName),
				imageUrl: illustrationUrlFor(last.sciName, "perched"),
				firstAt: first.detectedAt,
				lastAt: last.detectedAt,
				ageMs: generatedAtMs - timestampToMillis(last.detectedAt),
				detections: visit.moments.length,
				confidence: best.confidence,
				audioUrl: withAudio
					? audioUrlFor(best.date, best.comName, best.fileName)
					: null,
			};
		}),
	);
}

export const getNowSnapshot = createServerFn({ method: "GET" }).handler(
	async (): Promise<NowSnapshot> => {
		const generatedAtDate = new Date();
		const generatedAtMs = generatedAtDate.getTime();

		const latest = await getLatestRow();
		const withAudio = await canHearEveryClip();
		const [current, window, anyDetections] = await Promise.all([
			latest ? buildCurrentBird(latest, generatedAtMs, withAudio) : null,
			getWindowVisits(latest ? detectionKey(latest) : undefined),
			latest ? true : hasAnyDetections(),
		]);

		return {
			generatedAt: localTimestamp(generatedAtDate),
			current,
			hasAnyDetections: anyDetections,
			summary: { detections: window.rows.length },
			recent: await buildRecentVisits(window.log, generatedAtMs, withAudio),
		};
	},
);

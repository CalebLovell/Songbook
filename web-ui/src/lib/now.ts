import { createServerFn } from "@tanstack/react-start";
import { avg, count, desc, sql } from "drizzle-orm";

import { dataVersion, db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import { canHearEveryClip } from "~/lib/clip-access.server.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { shareRead } from "~/lib/shared-read.ts";
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

type NowSummary = {
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

function detectionKey(row: { detectedAt: string; fileName: string }): string {
	return `${row.detectedAt}-${row.fileName}`;
}

type WindowRow = {
	comName: string;
	sciName: string;
	date: string;
	detectedAt: string;
	confidence: number | null;
	fileName: string;
	timestamp: string;
};

async function buildCurrentBird(
	latest: WindowRow,
	windowRows: WindowRow[],
	withAudio: boolean,
): Promise<Omit<CurrentBird, "ageMs">> {
	const [allTime] = await db
		.select({
			allTimeCount: count(),
			averageConfidence: avg(detections.Confidence),
		})
		.from(detections)
		.where(sql`${detections.Com_Name} = ${latest.comName}`);
	const moments = windowRows
		.filter((row) => row.comName === latest.comName)
		.map((row) => row.detectedAt);

	return {
		key: detectionKey(latest),
		comName: latest.comName,
		sciName: latest.sciName,
		speciesSlug: comNameToSlug(latest.comName),
		imageUrl: illustrationUrlFor(latest.sciName, "flight"),
		detectedAt: latest.detectedAt,
		confidence: latest.confidence,
		audioUrl: withAudio
			? audioUrlFor(latest.date, latest.comName, latest.fileName)
			: null,
		countLast24h: moments.length,
		visitsLast24h: countVisits(moments),
		averageConfidence:
			allTime.averageConfidence != null
				? Number(allTime.averageConfidence)
				: null,
		firstHeardLast24h: moments.reduce((earliest, moment) =>
			moment < earliest ? moment : earliest,
		),
		allTimeCount: allTime.allTimeCount,
	};
}

async function getWindowRows(): Promise<WindowRow[]> {
	const rows = await db
		.select({
			comName: detections.Com_Name,
			sciName: detections.Sci_Name,
			date: detections.Date,
			detectedAt,
			confidence: detections.Confidence,
			fileName: detections.File_Name,
		})
		.from(detections)
		.where(isLast24h)
		.orderBy(desc(detections.Date), desc(detections.Time));
	return rows.map((row) => ({ ...row, timestamp: row.detectedAt }));
}

async function hasAnyDetections(): Promise<boolean> {
	const [row] = await db
		.select({ rowId: sql<number>`rowid` })
		.from(detections)
		.limit(1);
	return row !== undefined;
}

function buildRecentVisits(
	log: Visit<WindowRow>[],
	withAudio: boolean,
): Omit<RecentVisit, "ageMs">[] {
	return log.slice(0, RECENT_LIMIT).map((visit) => {
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
			detections: visit.moments.length,
			confidence: best.confidence,
			audioUrl: withAudio
				? audioUrlFor(best.date, best.comName, best.fileName)
				: null,
		};
	});
}

async function loadNowData(withAudio: boolean) {
	const rows = await getWindowRows();
	const latest = rows.at(0);
	const heroKey = latest && detectionKey(latest);
	const log = groupVisits(rows).filter(
		(visit) =>
			detectionKey(visit.moments[visit.moments.length - 1]) !== heroKey,
	);

	return {
		current: latest ? await buildCurrentBird(latest, rows, withAudio) : null,
		hasAnyDetections: latest ? true : await hasAnyDetections(),
		summary: { detections: rows.length },
		recent: buildRecentVisits(log, withAudio),
	};
}

const NOW_DATA_MAX_AGE_MS = 60_000;

const nowDataReads = new Map<boolean, () => ReturnType<typeof loadNowData>>();

function readNowData(withAudio: boolean) {
	let read = nowDataReads.get(withAudio);
	if (!read) {
		read = shareRead(() => loadNowData(withAudio), {
			maxAgeMs: NOW_DATA_MAX_AGE_MS,
			version: dataVersion,
		});
		nowDataReads.set(withAudio, read);
	}
	return read();
}

export const getNowSnapshot = createServerFn({ method: "GET" }).handler(
	async (): Promise<NowSnapshot> => {
		const generatedAtDate = new Date();
		const generatedAtMs = generatedAtDate.getTime();
		const { current, hasAnyDetections, summary, recent } = await readNowData(
			await canHearEveryClip(),
		);

		return {
			generatedAt: localTimestamp(generatedAtDate),
			current: current && {
				...current,
				ageMs: generatedAtMs - timestampToMillis(current.detectedAt),
			},
			hasAnyDetections,
			summary,
			recent: recent.map((visit) => ({
				...visit,
				ageMs: generatedAtMs - timestampToMillis(visit.lastAt),
			})),
		};
	},
);

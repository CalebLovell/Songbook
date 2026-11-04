import { count, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import {
	ARRIVAL_WINDOW_DAYS,
	type ArrivalSpecies,
	type MarkerDetection,
	MIGRATION_LIST_LIMIT,
	QUIET_AFTER_DAYS,
	type QuietSpecies,
	RESIDENT_MIN_DAYS,
} from "~/lib/migration-data.ts";
import { timestampToMillis } from "~/lib/visits.ts";

type MarkerRow = {
	comName: string;
	date: string;
	detectedAt: string;
	confidence: number | null;
	fileName: string;
};

// Bare columns outside the GROUP BY on purpose: with exactly one min() or max(),
// SQLite takes them from the row that matched.
async function getMarkerDetections(
	comNames: string[],
	edge: "first" | "last",
	windowFilter?: ReturnType<typeof sql>,
): Promise<Map<string, MarkerDetection>> {
	if (comNames.length === 0) return new Map();

	const detectedAt = sql<string>`${detections.Date} || ' ' || ${detections.Time}`;
	const pick =
		edge === "last" ? sql`max(${detectedAt})` : sql`min(${detectedAt})`;
	const scope = windowFilter
		? sql`${detections.Com_Name} in ${comNames} and (${windowFilter})`
		: sql`${detections.Com_Name} in ${comNames}`;

	const rows: MarkerRow[] = await db
		.select({
			comName: detections.Com_Name,
			date: detections.Date,
			detectedAt: sql<string>`${pick}`,
			confidence: detections.Confidence,
			fileName: detections.File_Name,
		})
		.from(detections)
		.where(scope)
		.groupBy(detections.Com_Name);

	const nowMs = Date.now();

	return new Map(
		rows.map((row) => [
			row.comName,
			{
				detectedAt: row.detectedAt,
				ageMs: nowMs - timestampToMillis(row.detectedAt),
				confidence: row.confidence,
				audioUrl: audioUrlFor(row.date, row.comName, row.fileName),
			},
		]),
	);
}

const NO_MARKER: MarkerDetection = {
	detectedAt: "",
	ageMs: 0,
	confidence: null,
	audioUrl: null,
};

export async function getQuietSpecies(): Promise<QuietSpecies[]> {
	const rows = await db
		.select({
			comName: detections.Com_Name,
			sciName: detections.Sci_Name,
			count: count(),
			lastSeen: sql<string>`max(${detections.Date})`,
		})
		.from(detections)
		.groupBy(detections.Com_Name, detections.Sci_Name)
		.having(
			sql`count(distinct ${detections.Date}) >= ${RESIDENT_MIN_DAYS}
			    and max(${detections.Date}) < date('now', 'localtime', ${`-${QUIET_AFTER_DAYS} days`})`,
		)
		.orderBy(sql`max(${detections.Date}) asc`, detections.Com_Name)
		.limit(MIGRATION_LIST_LIMIT);

	const markers = await getMarkerDetections(
		rows.map((row) => row.comName),
		"last",
	);

	return Promise.all(
		rows.map(async (row) => ({
			...row,
			...(markers.get(row.comName) ?? NO_MARKER),
			imageUrl: illustrationUrlFor(row.sciName),
		})),
	);
}

export async function getNewArrivals(): Promise<ArrivalSpecies[]> {
	const recentStart = sql`date('now', 'localtime', ${`-${ARRIVAL_WINDOW_DAYS} days`})`;
	const priorStart = sql`date('now', 'localtime', ${`-${ARRIVAL_WINDOW_DAYS * 2} days`})`;
	const inWindow = sql`${detections.Date} >= ${recentStart}`;

	const rows = await db
		.select({
			comName: detections.Com_Name,
			sciName: detections.Sci_Name,
			count: count(),
			firstSeen: sql<string>`min(${detections.Date})`,
		})
		.from(detections)
		.where(inWindow)
		.groupBy(detections.Com_Name, detections.Sci_Name)
		.having(
			sql`${detections.Com_Name} not in (
				select ${detections.Com_Name} from ${detections}
				where ${detections.Date} >= ${priorStart} and ${detections.Date} < ${recentStart}
			)`,
		)
		.orderBy(sql`min(${detections.Date}) desc`, detections.Com_Name)
		.limit(MIGRATION_LIST_LIMIT);

	const markers = await getMarkerDetections(
		rows.map((row) => row.comName),
		"first",
		inWindow,
	);

	return Promise.all(
		rows.map(async (row) => ({
			...row,
			...(markers.get(row.comName) ?? NO_MARKER),
			imageUrl: illustrationUrlFor(row.sciName),
		})),
	);
}

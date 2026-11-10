import "@tanstack/react-start/server-only";

import { and, count, gte, lt, or, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import {
	darkClockBounds,
	type NightRow,
	type StationPlace,
} from "~/lib/after-dark.ts";
import { dayIdFor } from "~/lib/day.ts";
import type { DayTally } from "~/lib/highlights-data.ts";
import { detectedAt, isLast24h } from "~/lib/now.ts";
import { addDays } from "~/lib/timeline-window.ts";

const isBeforeWindow = sql`${detectedAt} < datetime('now', '-24 hours', 'localtime')`;

const daySlice = sql<
	number | null
>`cast(julianday('now', 'localtime') - julianday(${detectedAt}) as integer)`;

export type LiveTallies = {
	hasAnyDetections: boolean;
	slices: DayTally[];
	firstInWindow: Map<string, string>;
	history: Map<string, { countBefore: number; lastBefore: string }>;
	daysBefore: Set<string>[];
	hourCounts: number[];
};

export async function readLiveTallies(longest: number): Promise<LiveTallies> {
	const lookback = `-${longest + 1} days`;
	const isInLookback = sql`${detections.Date} >= date('now', ${lookback}, 'localtime') and ${detectedAt} >= datetime('now', ${lookback}, 'localtime')`;

	const [sliceRows, hourRows] = await Promise.all([
		db
			.select({
				slice: daySlice,
				comName: detections.Com_Name,
				countInLookback: sql<number>`count(case when ${isInLookback} then 1 end)`,
				firstInWindow: sql<
					string | null
				>`min(case when ${isLast24h} then ${detectedAt} end)`,
				countBefore: sql<number>`count(case when ${isBeforeWindow} then 1 end)`,
				lastBefore: sql<
					string | null
				>`max(case when ${isBeforeWindow} then ${detectedAt} end)`,
			})
			.from(detections)
			.groupBy(daySlice, detections.Com_Name),
		db
			.select({
				hour: sql<string>`strftime('%H', ${detections.Time})`,
				count: count(),
			})
			.from(detections)
			.where(isLast24h)
			.groupBy(sql`strftime('%H', ${detections.Time})`),
	]);

	const slices: DayTally[] = Array.from(
		{ length: longest + 1 },
		() => new Map(),
	);
	const firstInWindow = new Map<string, string>();
	const history = new Map<
		string,
		{ countBefore: number; lastBefore: string }
	>();
	const speciesBySliceBefore: { slice: number; comName: string }[] = [];

	for (const row of sliceRows) {
		const { slice, comName } = row;
		if (slice === null) continue;
		if (row.countInLookback > 0 && slice >= 0 && slice <= longest) {
			slices[slice].set(comName, row.countInLookback);
		}
		if (row.firstInWindow !== null) {
			const earliest = firstInWindow.get(comName);
			if (earliest === undefined || row.firstInWindow < earliest) {
				firstInWindow.set(comName, row.firstInWindow);
			}
		}
		if (row.lastBefore !== null) {
			const seen = history.get(comName);
			history.set(comName, {
				countBefore: (seen?.countBefore ?? 0) + row.countBefore,
				lastBefore:
					seen && seen.lastBefore > row.lastBefore
						? seen.lastBefore
						: row.lastBefore,
			});
			speciesBySliceBefore.push({ slice, comName });
		}
	}

	const oldestSlice = Math.max(
		0,
		...speciesBySliceBefore.map((row) => row.slice),
	);
	const daysBefore = Array.from(
		{ length: oldestSlice },
		() => new Set<string>(),
	);
	for (const { slice, comName } of speciesBySliceBefore)
		if (slice >= 1) daysBefore[slice - 1].add(comName);

	const hourCounts = Array<number>(24).fill(0);
	for (const row of hourRows) hourCounts[Number(row.hour)] = row.count;

	return {
		hasAnyDetections: sliceRows.length > 0,
		slices,
		firstInWindow,
		history,
		daysBefore,
		hourCounts,
	};
}

export async function readLiveNightRows(
	place: StationPlace,
	now: Date = new Date(),
): Promise<NightRow[]> {
	const today = dayIdFor(now);
	const bounds = darkClockBounds([addDays(today, -1), today], place);
	if (!bounds) return [];
	return db
		.select({
			comName: detections.Com_Name,
			date: detections.Date,
			time: detections.Time,
			confidence: detections.Confidence,
		})
		.from(detections)
		.where(
			and(
				isLast24h,
				or(
					lt(detections.Time, bounds.before),
					gte(detections.Time, bounds.from),
				),
			),
		);
}

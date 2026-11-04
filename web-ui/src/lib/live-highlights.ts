import { createServerFn } from "@tanstack/react-start";
import { count, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import {
	type HighlightThresholds,
	lookbackFor,
} from "~/lib/highlight-thresholds.ts";
import {
	type DayTally,
	type Highlight,
	judgeHighlights,
} from "~/lib/highlights-data.ts";
import { detectedAt, isLast24h } from "~/lib/now.ts";
import { readHighlightThresholds } from "~/lib/settings-config.server.ts";
import { timestampToMillis } from "~/lib/visits.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

const isBeforeWindow = sql`${detectedAt} < datetime('now', '-24 hours', 'localtime')`;

const daySlice = sql<number>`cast(julianday('now', 'localtime') - julianday(${detectedAt}) as integer)`;

export type LiveHighlights = {
	hasAnyDetections: boolean;
	highlights: Highlight[];
	thresholds: HighlightThresholds;
};

export const getLiveHighlights = createServerFn({ method: "GET" }).handler(
	async (): Promise<LiveHighlights> => {
		const settings = await readHighlightThresholds();
		const nowMs = Date.now();
		const longest = Math.max(
			1,
			lookbackFor(settings.goneQuiet, "live"),
			lookbackFor(settings.returned, "live"),
			lookbackFor(settings.vocal, "live"),
		);

		const [windowRows, historyRows, hourRows, sliceRows, streakRows, [volume]] =
			await Promise.all([
				db
					.select({
						comName: detections.Com_Name,
						firstInWindow: sql<string>`min(${detectedAt})`,
					})
					.from(detections)
					.where(isLast24h)
					.groupBy(detections.Com_Name),
				db
					.select({
						comName: detections.Com_Name,
						countBefore: count(),
						lastBefore: sql<string>`max(${detectedAt})`,
					})
					.from(detections)
					.where(isBeforeWindow)
					.groupBy(detections.Com_Name),
				db
					.select({
						hour: sql<string>`strftime('%H', ${detections.Time})`,
						count: count(),
					})
					.from(detections)
					.where(isLast24h)
					.groupBy(sql`strftime('%H', ${detections.Time})`),
				db
					.select({
						slice: daySlice,
						comName: detections.Com_Name,
						count: count(),
					})
					.from(detections)
					.where(
						sql`${detections.Date} >= date('now', ${`-${longest + 1} days`}, 'localtime') and ${detectedAt} >= datetime('now', ${`-${longest + 1} days`}, 'localtime')`,
					)
					.groupBy(daySlice, detections.Com_Name),
				db
					.select({ slice: daySlice, comName: detections.Com_Name })
					.from(detections)
					.where(isBeforeWindow)
					.groupBy(daySlice, detections.Com_Name),
				db.select({ allTimeCount: count() }).from(detections),
			]);

		if (!volume || volume.allTimeCount === 0) {
			return {
				hasAnyDetections: false,
				highlights: [],
				thresholds: settings,
			};
		}

		const slices: DayTally[] = Array.from(
			{ length: longest + 1 },
			() => new Map(),
		);
		for (const row of sliceRows) {
			if (row.slice < 0 || row.slice > longest) continue;
			slices[row.slice].set(row.comName, row.count);
		}

		const daysBetween = (fromMs: number, toMs: number) =>
			Math.floor((toMs - fromMs) / DAY_MS);
		const firstInWindow = new Map(
			windowRows.map((row) => [row.comName, row.firstInWindow]),
		);
		const lifetime = new Map<string, number>();
		const awayDays = new Map<string, number>();
		const silentDays = new Map<string, number>();
		for (const row of historyRows) {
			const lastMs = timestampToMillis(row.lastBefore);
			const first = firstInWindow.get(row.comName);
			lifetime.set(
				row.comName,
				row.countBefore + (slices[0].get(row.comName) ?? 0),
			);
			if (first)
				awayDays.set(
					row.comName,
					daysBetween(lastMs, timestampToMillis(first)),
				);
			else silentDays.set(row.comName, daysBetween(lastMs, nowMs));
		}
		for (const [comName, n] of slices[0])
			if (!lifetime.has(comName)) lifetime.set(comName, n);

		const hourCounts = Array<number>(24).fill(0);
		for (const row of hourRows) hourCounts[Number(row.hour)] = row.count;

		const oldestSlice = Math.max(0, ...streakRows.map((row) => row.slice));
		const daysBefore = Array.from(
			{ length: oldestSlice },
			() => new Set<string>(),
		);
		for (const { slice, comName } of streakRows)
			if (slice >= 1) daysBefore[slice - 1].add(comName);

		const { highlights } = judgeHighlights(
			{
				period: "live",
				window: [slices[0]],
				inProgress: false,
				before: slices.slice(1).map((slice) => [slice]),
				daysBefore,
				hourCounts,
				lifetime,
				heardBefore: new Set(historyRows.map((row) => row.comName)),
				awayDays,
				silentDays,
			},
			settings,
		);

		return { hasAnyDetections: true, highlights, thresholds: settings };
	},
);

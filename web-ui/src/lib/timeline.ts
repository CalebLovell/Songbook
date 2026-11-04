import { and, lt, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { dayIdFor } from "~/lib/day.ts";
import {
	type HighlightThresholds,
	lookbackFor,
} from "~/lib/highlight-thresholds.ts";
import {
	type DayTally,
	type Highlight,
	judgeHighlights,
	type VocalJump,
} from "~/lib/highlights-data.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { type SpeciesLink, speciesLinkFor } from "~/lib/species-link.ts";
import type { TimelinePeriod } from "~/lib/timeline-periods.ts";
import {
	addDays,
	anchorForDay,
	daysInRange,
	precedingWindows,
	type TimelineAnchor,
	type TimelineWindow,
	windowFor,
} from "~/lib/timeline-window.ts";

export type TimelineRequest = {
	period: TimelinePeriod;
	anchor: TimelineAnchor;
};

export type TimelineRow = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	speciesLink: SpeciesLink | null;
	totalDetections: number;
	hourCounts: number[];
	isNew: boolean;
	firstHeard: string | null;
	isRare: boolean;
	isConsistent: boolean;
	regularNote: string | null;
	isReturned: boolean;
	away: string | null;
	vocal: VocalJump | null;
};

export type TimelineData = {
	rows: TimelineRow[];
	highlights: Highlight[];
	window: TimelineWindow | null;
	prevAnchor: TimelineAnchor | null;
	nextAnchor: TimelineAnchor | null;
	lastActiveDay: string | null;
	stationRange: { first: string; last: string } | null;
	hasAnyDetections: boolean;
};

export type TimelineNav = Pick<
	TimelineData,
	| "window"
	| "prevAnchor"
	| "nextAnchor"
	| "lastActiveDay"
	| "stationRange"
	| "hasAnyDetections"
>;

export async function loadTimelineNav(
	period: TimelinePeriod,
	window: TimelineWindow | null,
): Promise<TimelineNav> {
	const [[neighbours], [stationBounds]] = await Promise.all([
		window
			? db
					.select({
						prev: sql<
							string | null
						>`max(case when ${detections.Date} < ${window.start} then ${detections.Date} end)`,
						next: sql<
							string | null
						>`min(case when ${detections.Date} > ${window.end} then ${detections.Date} end)`,
						inside: sql<
							string | null
						>`max(case when ${detections.Date} between ${window.start} and ${window.end} then ${detections.Date} end)`,
					})
					.from(detections)
			: Promise.resolve([{ prev: null, next: null, inside: null }]),
		db
			.select({
				first: sql<string | null>`min(${detections.Date})`,
				last: sql<string | null>`max(${detections.Date})`,
			})
			.from(detections),
	]);

	return {
		window,
		prevAnchor: neighbours.prev ? anchorForDay(period, neighbours.prev) : null,
		nextAnchor: neighbours.next ? anchorForDay(period, neighbours.next) : null,
		lastActiveDay: window
			? (neighbours.inside ?? neighbours.next ?? neighbours.prev)
			: stationBounds.last,
		stationRange:
			stationBounds.first && stationBounds.last
				? { first: stationBounds.first, last: stationBounds.last }
				: null,
		hasAnyDetections: stationBounds.first !== null,
	};
}

export async function loadTimelineData({
	period,
	anchor,
	settings,
}: TimelineRequest & { settings: HighlightThresholds }): Promise<TimelineData> {
	const window = windowFor(period, anchor);
	const inWindow = window
		? and(
				sql`${detections.Date} >= ${window.start}`,
				sql`${detections.Date} <= ${window.end}`,
			)
		: undefined;
	const today = dayIdFor(new Date());

	const longest = Math.max(
		1,
		lookbackFor(settings.goneQuiet, period),
		lookbackFor(settings.returned, period),
		lookbackFor(settings.vocal, period),
	);
	const beforeWindows =
		period === "all" ? [] : precedingWindows(period, anchor, longest);
	const tallyFrom = beforeWindows.at(-1)?.start ?? window?.start ?? null;

	const [rows, tallyRows, beforeRows, lifetimeRows, streakRows, nav] =
		await Promise.all([
			db
				.select({
					comName: detections.Com_Name,
					sciName: detections.Sci_Name,
					hour: sql<string>`strftime('%H', ${detections.Time})`,
					count: sql<number>`count(*)`,
				})
				.from(detections)
				.where(inWindow)
				.groupBy(
					detections.Com_Name,
					detections.Sci_Name,
					sql`strftime('%H', ${detections.Time})`,
				),
			db
				.select({
					date: detections.Date,
					comName: detections.Com_Name,
					count: sql<number>`count(*)`,
				})
				.from(detections)
				.where(
					window && tallyFrom
						? and(
								sql`${detections.Date} >= ${tallyFrom}`,
								sql`${detections.Date} <= ${window.end}`,
							)
						: undefined,
				)
				.groupBy(detections.Date, detections.Com_Name),
			window
				? db
						.select({
							comName: detections.Com_Name,
							lastBefore: sql<string>`max(${detections.Date})`,
						})
						.from(detections)
						.where(lt(detections.Date, window.start))
						.groupBy(detections.Com_Name)
				: Promise.resolve([]),
			db
				.select({
					comName: detections.Com_Name,
					lifetime: sql<number>`count(*)`,
				})
				.from(detections)
				.groupBy(detections.Com_Name),
			period === "day" && window
				? db
						.select({ date: detections.Date, comName: detections.Com_Name })
						.from(detections)
						.where(lt(detections.Date, window.start))
						.groupBy(detections.Date, detections.Com_Name)
				: Promise.resolve([]),
			loadTimelineNav(period, window),
		]);

	const bySpecies = new Map<
		string,
		{ comName: string; sciName: string; hourCounts: number[] }
	>();
	for (const row of rows) {
		let entry = bySpecies.get(row.comName);
		if (!entry) {
			entry = {
				comName: row.comName,
				sciName: row.sciName,
				hourCounts: Array(24).fill(0),
			};
			bySpecies.set(row.comName, entry);
		}
		entry.hourCounts[Number(row.hour)] = row.count;
	}

	const tallies = new Map<string, DayTally>();
	for (const row of tallyRows) {
		const day = tallies.get(row.date) ?? new Map<string, number>();
		day.set(row.comName, row.count);
		tallies.set(row.date, day);
	}
	const daysOf = (start: string, end: string): DayTally[] => {
		const days: DayTally[] = [];
		for (let day = start; day <= end; day = addDays(day, 1))
			days.push(tallies.get(day) ?? new Map());
		return days;
	};

	const windowStart = window?.start ?? nav.stationRange?.first ?? today;
	const windowEnd = window && window.end < today ? window.end : today;
	const windowDays = daysOf(windowStart, windowEnd);

	const firstDayByName = new Map<string, string>();
	for (const row of tallyRows) {
		if (row.date < windowStart || row.date > windowEnd) continue;
		const first = firstDayByName.get(row.comName);
		if (!first || row.date < first) firstDayByName.set(row.comName, row.date);
	}

	const awayDays = new Map<string, number>();
	const silentDays = new Map<string, number>();
	for (const { comName, lastBefore } of beforeRows) {
		const firstDay = firstDayByName.get(comName);
		if (firstDay) awayDays.set(comName, daysInRange(lastBefore, firstDay) - 1);
		else silentDays.set(comName, daysInRange(lastBefore, windowEnd) - 1);
	}

	const lifetimeByName = new Map(
		lifetimeRows.map((row) => [row.comName, row.lifetime]),
	);
	const hourCounts = Array.from({ length: 24 }, (_, hour) =>
		Array.from(bySpecies.values()).reduce(
			(sum, entry) => sum + (entry.hourCounts[hour] ?? 0),
			0,
		),
	);

	const { highlights, flags } = judgeHighlights(
		{
			period,
			window: windowDays,
			inProgress: window != null && window.end >= today,
			before: beforeWindows.map((w) => daysOf(w.start, w.end)),
			daysBefore: daysHeardBefore(
				windowStart,
				streakRows,
				nav.stationRange?.first ?? null,
			),

			hourCounts,
			lifetime: lifetimeByName,
			heardBefore: new Set(beforeRows.map((row) => row.comName)),
			awayDays,
			silentDays,
		},
		settings,
	);

	const withImages = Array.from(bySpecies.values()).map((entry) => {
		const flag = flags.get(entry.comName);
		return {
			comName: entry.comName,
			sciName: entry.sciName,
			imageUrl: illustrationUrlFor(entry.sciName),
			speciesLink: speciesLinkFor(entry.sciName),
			totalDetections: entry.hourCounts.reduce((a, b) => a + b, 0),
			hourCounts: entry.hourCounts,
			isNew: flag?.isNew ?? false,
			firstHeard: flag?.isNew
				? (firstDayByName.get(entry.comName) ?? null)
				: null,
			isRare: flag?.isRare ?? false,
			isConsistent: flag?.isConsistent ?? false,
			regularNote: flag?.regularNote ?? null,
			isReturned: flag?.isReturned ?? false,
			away: flag?.away ?? null,
			vocal: flag?.vocal ?? null,
		};
	});

	return {
		rows: withImages.sort((a, b) => b.totalDetections - a.totalDetections),
		highlights,
		...nav,
	};
}

function daysHeardBefore(
	start: string,
	rows: { date: string; comName: string }[],
	stationFirst: string | null,
): Set<string>[] {
	if (!stationFirst || rows.length === 0) return [];
	const heard = new Map<string, Set<string>>();
	for (const { date, comName } of rows) {
		const species = heard.get(date) ?? new Set<string>();
		species.add(comName);
		heard.set(date, species);
	}
	const days: Set<string>[] = [];
	for (
		let day = addDays(start, -1);
		day >= stationFirst;
		day = addDays(day, -1)
	)
		days.push(heard.get(day) ?? new Set());
	return days;
}

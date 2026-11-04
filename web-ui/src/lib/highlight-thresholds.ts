import type { Highlight } from "~/lib/highlights-data.ts";

export type HighlightPeriod =
	| "live"
	| "day"
	| "week"
	| "month"
	| "year"
	| "all";

export type Lookback = { days: number; weeks: number; months: number };

export type HighlightThresholds = {
	rareMax: number;
	consistent: { streakDays: number; yearShare: number; allTimeShare: number };
	goneQuiet: Lookback;
	returned: Lookback;
	vocal: Lookback & { ratio: number; minDetections: number; presence: number };
};

export const HIGHLIGHT_THRESHOLDS: HighlightThresholds = {
	rareMax: 5,
	consistent: { streakDays: 10, yearShare: 90, allTimeShare: 90 },
	goneQuiet: { days: 10, weeks: 3, months: 3 },
	returned: { days: 10, weeks: 1, months: 1 },
	vocal: {
		days: 10,
		weeks: 1,
		months: 1,
		ratio: 3,
		minDetections: 10,
		presence: 25,
	},
};

export type HighlightKnobs = {
	rareMax: number;
	returnedDays: number;
	goneQuietDays: number;
	regularDays: number;
	vocalRatio: number;
};

export function thresholdsFromSettings(
	knobs: HighlightKnobs,
): HighlightThresholds {
	const base = HIGHLIGHT_THRESHOLDS;
	return {
		rareMax: knobs.rareMax,
		consistent: { ...base.consistent, streakDays: knobs.regularDays },
		goneQuiet: { ...base.goneQuiet, days: knobs.goneQuietDays },
		returned: { ...base.returned, days: knobs.returnedDays },
		vocal: { ...base.vocal, ratio: knobs.vocalRatio },
	};
}

export function lookbackFor(lookback: Lookback, period: HighlightPeriod) {
	switch (period) {
		case "live":
		case "day":
			return lookback.days;
		case "week":
			return lookback.weeks;
		case "month":
			return lookback.months;
		case "year":
			return 1;
		case "all":
			return 0;
	}
}

export type HighlightGuideEntry = {
	kind: Highlight["kind"];
	name: string;
	meaning: string;
};

const UNIT: Record<
	Exclude<HighlightPeriod, "all">,
	{ one: string; this: string; last: string }
> = {
	live: { one: "day", this: "today", last: "yesterday" },
	day: { one: "day", this: "today", last: "yesterday" },
	week: { one: "week", this: "this week", last: "last week" },
	month: { one: "month", this: "this month", last: "last month" },
	year: { one: "year", this: "this year", last: "last year" },
};

export function highlightGuide(
	period: HighlightPeriod,
	thresholds: HighlightThresholds = HIGHLIGHT_THRESHOLDS,
): HighlightGuideEntry[] {
	const busiest: HighlightGuideEntry = {
		kind: "busiest-hour",
		name: "Busiest hour",
		meaning: "Most detections.",
	};
	if (period === "all")
		return [
			busiest,
			{
				kind: "consistent",
				name: "Regular",
				meaning: `Heard on over ${thresholds.consistent.allTimeShare}% of days.`,
			},
		];

	const unit = UNIT[period];
	const past = (lookback: Lookback) => {
		const n = lookbackFor(lookback, period);
		return n === 1 ? unit.last : `the past ${n} ${unit.one}s`;
	};

	return [
		{
			kind: "activity",
			name: "Trend",
			meaning: `Activity compared with ${period === "live" ? "the previous 24 hours" : unit.last}.`,
		},
		busiest,
		{ kind: "new", name: "New", meaning: "First record ever." },
		{
			kind: "rare",
			name: "Rare",
			meaning: `${thresholds.rareMax} or fewer records.`,
		},
		{
			kind: "vocal",
			name: "Vocal",
			meaning: `Birds heard ${thresholds.vocal.ratio}× their usual amount.`,
		},
		{
			kind: "returned",
			name: "Returned",
			meaning: `Silent ${past(thresholds.returned)}, back ${unit.this}.`,
		},
		{
			kind: "consistent",
			name: "Regular",
			meaning:
				period === "live" || period === "day"
					? `Heard ${thresholds.consistent.streakDays}+ days straight.`
					: period === "year"
						? `Heard on over ${thresholds.consistent.yearShare}% of days.`
						: `Heard every day ${unit.this}.`,
		},
		{
			kind: "routine",
			name: "Gone quiet",
			meaning: "A regular that has stopped singing.",
		},
	];
}

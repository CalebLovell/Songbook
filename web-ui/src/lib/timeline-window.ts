import { stationToday } from "~/lib/station-time.ts";
import type { TimelinePeriod } from "~/lib/timeline-periods.ts";

export type TimelineAnchor = string;

export type TimelineWindow = {
	start: string;
	end: string;
	label: string;
};

const DAY_MS = 86_400_000;

const ANCHOR_PATTERNS: Record<TimelinePeriod, RegExp> = {
	day: /^\d{4}-\d{2}-\d{2}$/,
	week: /^\d{4}-W\d{2}$/,
	month: /^\d{4}-\d{2}$/,
	year: /^\d{4}$/,
	all: /^$/,
};

const WEEKDAY_NAME = new Intl.DateTimeFormat("en-US", {
	weekday: "long",
	timeZone: "UTC",
});
const MONTH_NAME = new Intl.DateTimeFormat("en-US", {
	month: "long",
	timeZone: "UTC",
});
const SHORT_MONTH_NAME = new Intl.DateTimeFormat("en-US", {
	month: "short",
	timeZone: "UTC",
});
const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});
const ORDINAL = new Intl.PluralRules("en-US", { type: "ordinal" });
const ORDINAL_SUFFIX: Partial<Record<Intl.LDMLPluralRule, string>> = {
	one: "st",
	two: "nd",
	few: "rd",
};

function spelledDay(date: Date, { short = false } = {}): string {
	const day = date.getUTCDate();
	const suffix = ORDINAL_SUFFIX[ORDINAL.select(day)] ?? "th";
	const month = (short ? SHORT_MONTH_NAME : MONTH_NAME).format(date);
	return `${month} ${day}${suffix}`;
}

export function spelledDate(day: string, { short = false } = {}): string {
	const date = utcDate(day);
	return `${spelledDay(date, { short })}, ${date.getUTCFullYear()}`;
}

function utcDate(day: string): Date {
	return new Date(`${day}T00:00:00Z`);
}

function dayString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function shiftDays(day: string, delta: number): string {
	return dayString(new Date(utcDate(day).getTime() + delta * DAY_MS));
}

function isoWeekMonday(day: string): Date {
	const date = utcDate(day);
	const offset = (date.getUTCDay() + 6) % 7;
	return new Date(date.getTime() - offset * DAY_MS);
}

function isoWeekAnchor(day: string): TimelineAnchor {
	const monday = isoWeekMonday(day);
	const thursday = new Date(monday.getTime() + 3 * DAY_MS);
	const year = thursday.getUTCFullYear();
	const firstThursday = new Date(
		isoWeekMonday(`${year}-01-04`).getTime() + 3 * DAY_MS,
	);
	const week =
		1 +
		Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
	return `${year}-W${String(week).padStart(2, "0")}`;
}

function isoWeekAnchorMonday(anchor: TimelineAnchor): Date {
	const year = Number(anchor.slice(0, 4));
	const week = Number(anchor.slice(6));
	const week1Monday = isoWeekMonday(`${year}-01-04`);
	return new Date(week1Monday.getTime() + (week - 1) * 7 * DAY_MS);
}

export function isValidAnchor(period: TimelinePeriod, anchor: string): boolean {
	if (period === "all") return true;
	if (!ANCHOR_PATTERNS[period].test(anchor)) return false;

	switch (period) {
		case "day": {
			const parsed = utcDate(anchor);
			return !Number.isNaN(parsed.getTime()) && dayString(parsed) === anchor;
		}
		case "week": {
			const monday = isoWeekAnchorMonday(anchor);
			return (
				!Number.isNaN(monday.getTime()) &&
				isoWeekAnchor(dayString(monday)) === anchor
			);
		}
		case "month": {
			const month = Number(anchor.slice(5, 7));
			return month >= 1 && month <= 12;
		}
		case "year":
			return true;
	}
}

const SHORT_MONTH = new Intl.DateTimeFormat("en-US", {
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});

export function shortAnchorLabel(
	period: Exclude<TimelinePeriod, "all">,
	anchor: TimelineAnchor,
	{ compact = false }: { compact?: boolean } = {},
): string {
	if (!isValidAnchor(period, anchor)) return anchor;
	switch (period) {
		case "day":
			return spelledDate(anchor, { short: true });
		case "week":
			return `${compact ? "Wk" : "Week"} ${Number(anchor.slice(6))}, ${anchor.slice(0, 4)}`;
		case "month":
			return SHORT_MONTH.format(utcDate(`${anchor}-01`));
		case "year":
			return anchor;
	}
}

export function anchorForDay(
	period: TimelinePeriod,
	day: string,
): TimelineAnchor {
	switch (period) {
		case "day":
			return day;
		case "week":
			return isoWeekAnchor(day);
		case "month":
			return day.slice(0, 7);
		case "year":
			return day.slice(0, 4);
		case "all":
			return "";
	}
}

export function currentAnchor(
	period: TimelinePeriod,
	now: Date = new Date(),
): TimelineAnchor {
	return anchorForDay(period, stationToday(now));
}

export function windowFor(
	period: "all",
	anchor: TimelineAnchor,
): TimelineWindow | null;
export function windowFor(
	period: Exclude<TimelinePeriod, "all">,
	anchor: TimelineAnchor,
): TimelineWindow;
export function windowFor(
	period: TimelinePeriod,
	anchor: TimelineAnchor,
): TimelineWindow | null;
export function windowFor(
	period: TimelinePeriod,
	anchor: TimelineAnchor,
): TimelineWindow | null {
	switch (period) {
		case "day":
			return {
				start: anchor,
				end: anchor,
				label: `${WEEKDAY_NAME.format(utcDate(anchor))}, ${spelledDate(anchor)}`,
			};
		case "week": {
			const monday = isoWeekAnchorMonday(anchor);
			const start = dayString(monday);
			const end = shiftDays(start, 6);
			return {
				start,
				end,
				label: `${spelledDay(monday, { short: true })} to ${spelledDay(utcDate(end), { short: true })}, ${utcDate(end).getUTCFullYear()}`,
			};
		}
		case "month": {
			const start = `${anchor}-01`;
			const year = Number(anchor.slice(0, 4));
			const month = Number(anchor.slice(5, 7));
			const end = dayString(new Date(Date.UTC(year, month, 0)));
			return { start, end, label: MONTH_LABEL.format(utcDate(start)) };
		}
		case "year":
			return {
				start: `${anchor}-01-01`,
				end: `${anchor}-12-31`,
				label: anchor,
			};
		case "all":
			return null;
	}
}

export function previousPeriodStart(
	period: TimelinePeriod,
	anchor: TimelineAnchor,
): string | null {
	const window = windowFor(period, anchor);
	if (!window) return null;
	const dayInPrevPeriod = shiftDays(window.start, -1);
	return (
		windowFor(period, anchorForDay(period, dayInPrevPeriod))?.start ?? null
	);
}

export function stepAnchor(
	period: Exclude<TimelinePeriod, "all">,
	anchor: TimelineAnchor,
	direction: -1 | 1,
): TimelineAnchor {
	const window = windowFor(period, anchor);
	const edge = direction < 0 ? window.start : window.end;
	return anchorForDay(period, shiftDays(edge, direction));
}

export function daysInRange(start: string, end: string): number {
	return (
		Math.round((utcDate(end).getTime() - utcDate(start).getTime()) / DAY_MS) + 1
	);
}

export function addDays(day: string, delta: number): string {
	return shiftDays(day, delta);
}

export function precedingWindows(
	period: TimelinePeriod,
	anchor: TimelineAnchor,
	count: number,
): TimelineWindow[] {
	const windows: TimelineWindow[] = [];
	let current = anchor;
	for (let step = 0; step < count; step++) {
		const start = previousPeriodStart(period, current);
		if (start == null) break;
		current = anchorForDay(period, start);
		const window = windowFor(period, current);
		if (window) windows.push(window);
	}
	return windows;
}

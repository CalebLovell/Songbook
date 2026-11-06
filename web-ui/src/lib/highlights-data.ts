import {
	type HighlightPeriod,
	type HighlightThresholds,
	lookbackFor,
} from "~/lib/highlight-thresholds.ts";

export const MAX_NAMED_BIRDS = 10;

export type HighlightBird = {
	comName: string;
	note: string | null;
	shareNote?: string;
};

export type SpeciesHighlightKind =
	| "new"
	| "rare"
	| "consistent"
	| "routine"
	| "returned"
	| "vocal";

export type Highlight =
	| {
			kind: "activity";
			direction: "up" | "down" | "level";
			percent: number;
			baselineLabel: string;
			count: number;
			delta: number;
	  }
	| { kind: "busiest-hour"; hour: number }
	| {
			kind: SpeciesHighlightKind;
			total: number;
			birds: HighlightBird[];
	  };

export type DayTally = Map<string, number>;

export type HighlightEvidence = {
	period: HighlightPeriod;
	window: DayTally[];
	inProgress: boolean;
	before: DayTally[][];
	daysBefore: Set<string>[];
	hourCounts: number[];
	lifetime: Map<string, number>;
	heardBefore: Set<string>;
	awayDays: Map<string, number>;
	silentDays: Map<string, number>;
};

export type VocalJump = {
	count: number;
	usual: number;
	ratio: number;
	period: HighlightPeriod;
};

type SpeciesFlags = {
	isNew: boolean;
	isRare: boolean;
	isConsistent: boolean;
	regularNote: string | null;
	isReturned: boolean;
	away: string | null;
	vocal: VocalJump | null;
};

export type HighlightJudgement = {
	highlights: Highlight[];
	flags: Map<string, SpeciesFlags>;
};

const AWAY_UNITS: Partial<
	Record<HighlightPeriod, { size: number; one: string; many: string }>
> = {
	week: { size: 7, one: "week", many: "weeks" },
	month: { size: 30.44, one: "month", many: "months" },
	year: { size: 365.25, one: "year", many: "years" },
};

export function formatAwayIn(days: number, period: HighlightPeriod): string {
	const unit = AWAY_UNITS[period];
	if (!unit) return `${days} ${plural(days, "day", "days")}`;
	const count = Math.max(1, Math.round(days / unit.size));
	return `${count} ${plural(count, unit.one, unit.many)}`;
}

export function formatRate(rate: number): string {
	const whole = Math.round(rate);
	return whole === 0 && rate > 0 ? "under 1" : whole.toLocaleString();
}

export function windowPhrase(period: HighlightPeriod): string {
	return period === "live" || period === "day"
		? "today"
		: period === "all"
			? "all time"
			: `this ${period}`;
}

export function formatVocal({
	count,
	usual,
	period,
}: Pick<VocalJump, "count" | "usual" | "period">): string {
	return `${formatRate(count)} ${windowPhrase(period)}, usually ${formatRate(usual)}`;
}

const PREVIOUS_PERIOD: Record<HighlightPeriod, string> = {
	live: "yesterday",
	day: "yesterday",
	week: "last week",
	month: "last month",
	year: "last year",
	all: "",
};

function plural(count: number, one: string, many: string): string {
	return count === 1 ? one : many;
}

const recorded = (day: DayTally) => day.size > 0;

function total(days: DayTally[], comName?: string): number {
	let sum = 0;
	for (const day of days) {
		if (comName == null) for (const n of day.values()) sum += n;
		else sum += day.get(comName) ?? 0;
	}
	return sum;
}

function speciesIn(days: DayTally[]): Set<string> {
	const names = new Set<string>();
	for (const day of days) for (const name of day.keys()) names.add(name);
	return names;
}

function speciesLine<Row extends { comName: string }>(
	kind: SpeciesHighlightKind,
	rows: Row[],
	noteFor: (row: Row) => string | null,
	shareNoteFor?: (row: Row) => string | undefined,
): Highlight | null {
	if (rows.length === 0) return null;
	return {
		kind,
		total: rows.length,
		birds: rows.slice(0, MAX_NAMED_BIRDS).map((row) => {
			const shareNote = shareNoteFor?.(row);
			return {
				comName: row.comName,
				note: noteFor(row),
				...(shareNote ? { shareNote } : {}),
			};
		}),
	};
}

export function judgeHighlights(
	evidence: HighlightEvidence,
	settings: HighlightThresholds,
): HighlightJudgement {
	const { period, window, before } = evidence;
	const flags = new Map<string, SpeciesFlags>();
	const windowTotal = total(window);
	if (windowTotal === 0) return { highlights: [], flags };

	const isAll = period === "all";
	const units = (n: number) => before.slice(0, n);
	const watched = (n: number) => {
		const span = units(n);
		return span.length === n && (span.at(-1)?.some(recorded) ?? false);
	};
	const windowCount = new Map<string, number>();
	for (const day of window)
		for (const [name, n] of day)
			windowCount.set(name, (windowCount.get(name) ?? 0) + n);
	const heard = Array.from(windowCount.keys());

	const isNew = (name: string) => !isAll && !evidence.heardBefore.has(name);
	const isRare = (name: string) =>
		!isAll &&
		evidence.heardBefore.has(name) &&
		(evidence.lifetime.get(name) ?? 0) <= settings.rareMax;

	const windowRecordedDays = window.filter(recorded);
	const regularShare = new Map<string, number>();
	const regularNote = new Map<string, string>();
	const regularShareNote = new Map<string, string>();
	const streakOf = (name: string) => {
		let count = 1;
		for (const species of evidence.daysBefore) {
			if (species.size === 0) continue;
			if (!species.has(name)) break;
			count++;
		}
		return count;
	};
	const isConsistent = (name: string) => {
		if (period === "live" || period === "day") {
			const streak = streakOf(name);
			regularShare.set(name, streak);
			regularNote.set(
				name,
				`${streak} ${plural(streak, "day", "days")} straight`,
			);
			regularShareNote.set(name, `${streak}-day streak`);
			return streak >= settings.consistent.streakDays;
		}
		if (windowRecordedDays.length === 0) return false;
		const daysHeard = windowRecordedDays.filter((day) => day.has(name)).length;
		const share = daysHeard / windowRecordedDays.length;
		regularShare.set(name, share);
		if (period === "week" || period === "month") {
			regularNote.set(
				name,
				`every day${evidence.inProgress ? " so far" : ""} ${windowPhrase(period)}`,
			);
			regularShareNote.set(
				name,
				`every day${evidence.inProgress ? " so far" : ""}`,
			);
			return daysHeard === windowRecordedDays.length;
		}
		regularNote.set(name, `${Math.round(share * 100)}% of days`);
		const bar =
			period === "year"
				? settings.consistent.yearShare
				: settings.consistent.allTimeShare;
		return daysHeard * 100 > bar * windowRecordedDays.length;
	};

	const returnedUnits = units(lookbackFor(settings.returned, period));
	const returnedSilentIn = speciesIn(returnedUnits.flat());
	const isReturned = (name: string) =>
		!isAll &&
		evidence.heardBefore.has(name) &&
		!returnedSilentIn.has(name) &&
		!isRare(name);

	const vocalN = lookbackFor(settings.vocal, period);
	const vocalUnits = units(vocalN).filter((unit) => unit.some(recorded));
	const vocalDays = vocalUnits.flat().filter(recorded);
	const vocalJump = (name: string): VocalJump | null => {
		if (isAll || vocalDays.length === 0) return null;
		const count = windowCount.get(name) ?? 0;
		if (count < settings.vocal.minDetections) return null;
		const daysHeard = vocalDays.filter((day) => day.has(name)).length;
		if (daysHeard === 0) return null;
		if ((daysHeard / vocalDays.length) * 100 < settings.vocal.presence)
			return null;
		const usual = total(vocalDays, name) / vocalUnits.length;
		const ratio = count / usual;
		return ratio >= settings.vocal.ratio
			? { count, usual, ratio, period }
			: null;
	};

	const awayFor = (name: string) => {
		const days = evidence.awayDays.get(name);
		return isReturned(name) && days != null ? formatAwayIn(days, period) : null;
	};

	for (const name of heard) {
		const returned = isReturned(name);
		const consistent = isConsistent(name);
		flags.set(name, {
			isNew: isNew(name),
			isRare: isRare(name),
			isConsistent: consistent,
			regularNote: consistent ? (regularNote.get(name) ?? null) : null,
			isReturned: returned,
			away: awayFor(name),
			vocal: vocalJump(name),
		});
	}

	const quietN = lookbackFor(settings.goneQuiet, period);
	const quietUnits = units(quietN).filter((unit) => unit.some(recorded));
	const goneQuiet =
		isAll || !watched(quietN)
			? []
			: Array.from(speciesIn(quietUnits.flat()))
					.filter(
						(name) =>
							!windowCount.has(name) &&
							quietUnits.every((unit) => unit.some((day) => day.has(name))),
					)
					.map((name) => ({
						comName: name,
						daysSilent: evidence.silentDays.get(name) ?? null,
						before: total(quietUnits.flat(), name),
					}))
					.sort((a, b) => b.before - a.before);

	const lines: Highlight[] = [];

	const previous = before[0] ?? [];
	const previousTotal = total(previous);
	if (previousTotal > 0) {
		const percent = Math.round(
			(Math.abs(windowTotal - previousTotal) / previousTotal) * 100,
		);
		lines.push({
			kind: "activity",
			direction:
				percent === 0 ? "level" : windowTotal > previousTotal ? "up" : "down",
			percent,
			baselineLabel: PREVIOUS_PERIOD[period],
			count: windowTotal,
			delta: windowTotal - previousTotal,
		});
	}

	lines.push({
		kind: "busiest-hour",
		hour: evidence.hourCounts.indexOf(Math.max(...evidence.hourCounts)),
	});

	const byCount = (a: string, b: string) =>
		(windowCount.get(b) ?? 0) - (windowCount.get(a) ?? 0);
	const tagged = (pick: (f: SpeciesFlags) => boolean) =>
		heard.filter((name) => pick(flags.get(name) as SpeciesFlags));

	for (const line of [
		speciesLine(
			"new",
			tagged((f) => f.isNew)
				.sort(byCount)
				.map((comName) => ({ comName })),
			() => null,
		),
		speciesLine(
			"rare",
			tagged((f) => f.isRare)
				.map((comName) => ({
					comName,
					lifetime: evidence.lifetime.get(comName) ?? 0,
				}))
				.sort((a, b) => a.lifetime - b.lifetime),
			(row) => `${row.lifetime} total`,
		),
		speciesLine(
			"vocal",
			heard
				.flatMap((comName) => {
					const jump = flags.get(comName)?.vocal;
					return jump ? [{ comName, ...jump }] : [];
				})
				.sort((a, b) => b.ratio - a.ratio),
			formatVocal,
			(row) => `${Math.round(row.ratio).toLocaleString()}× usual`,
		),
		speciesLine(
			"consistent",
			tagged((f) => f.isConsistent)
				.sort(
					(a, b) =>
						(regularShare.get(b) ?? 0) - (regularShare.get(a) ?? 0) ||
						byCount(a, b),
				)
				.map((comName) => ({ comName })),
			(row) => flags.get(row.comName)?.regularNote ?? null,
			(row) => regularShareNote.get(row.comName),
		),
		speciesLine(
			"returned",
			tagged((f) => f.isReturned)
				.map((comName) => ({
					comName,
					daysAway: evidence.awayDays.get(comName) ?? null,
				}))
				.sort((a, b) => (b.daysAway ?? 0) - (a.daysAway ?? 0)),
			(row) =>
				row.daysAway == null
					? null
					: `${formatAwayIn(row.daysAway, period)} missing`,
		),
		speciesLine("routine", goneQuiet, (row) =>
			row.daysSilent == null
				? null
				: `${formatAwayIn(row.daysSilent, period)} silent`,
		),
	])
		if (line) lines.push(line);

	return { highlights: lines, flags };
}

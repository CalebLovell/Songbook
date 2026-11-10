import { getTimes } from "suncalc";

import { addDays } from "~/lib/timeline-window.ts";

export const AFTER_DARK_MIN_CONFIDENCE = 0.85;

// BirdNET hears summer katydids and crickets as these birds, night after night.
export const INSECT_LOOKALIKES: ReadonlySet<string> = new Set([
	"Cedar Waxwing",
]);

export type StationPlace = {
	latitude: number;
	longitude: number;
	timezone: string;
};

export type DarkHours = { dawn: number; dusk: number };

export type NightRow = {
	comName: string;
	date: string;
	time: string;
	confidence: number | null;
};

export type NightSighting = {
	nights: number;
	latest: string;
	best: number;
};

const clocks = new Map<string, Intl.DateTimeFormat>();

function localMinutes(instant: Date, timeZone: string): number {
	let clock = clocks.get(timeZone);
	if (!clock) {
		clock = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		});
		clocks.set(timeZone, clock);
	}
	const parts = clock.formatToParts(instant);
	const part = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	return part("hour") * 60 + part("minute");
}

export function darkHours(day: string, place: StationPlace): DarkHours | null {
	const { latitude, longitude, timezone } = place;
	if (latitude === 0 && longitude === 0) return null;
	const noon = new Date(
		Date.parse(`${day}T12:00:00Z`) - (longitude / 15) * 3_600_000,
	);
	const { nauticalDawn, nauticalDusk } = getTimes(noon, latitude, longitude);
	if (
		!nauticalDawn ||
		!nauticalDusk ||
		Number.isNaN(nauticalDawn.getTime()) ||
		Number.isNaN(nauticalDusk.getTime())
	)
		return null;
	return {
		dawn: localMinutes(nauticalDawn, timezone),
		dusk: localMinutes(nauticalDusk, timezone),
	};
}

export function darkClockBounds(
	days: string[],
	place: StationPlace,
): { before: string; from: string } | null {
	let latestDawn = -1;
	let earliestDusk = 24 * 60;
	for (const day of days) {
		const hours = darkHours(day, place);
		if (!hours) continue;
		latestDawn = Math.max(latestDawn, hours.dawn);
		earliestDusk = Math.min(earliestDusk, hours.dusk);
	}
	if (latestDawn < 0) return null;
	return { before: clock(latestDawn + 1), from: clock(earliestDusk) };
}

function clock(minutes: number): string {
	const capped = Math.min(minutes, 24 * 60 - 1);
	return `${String(Math.floor(capped / 60)).padStart(2, "0")}:${String(capped % 60).padStart(2, "0")}`;
}

function minutesOf(time: string): number {
	const [hour, minute] = time.split(":").map(Number);
	return hour * 60 + minute;
}

export function nightOf(
	row: Pick<NightRow, "date" | "time">,
	hours: DarkHours,
): string | null {
	const minutes = minutesOf(row.time);
	if (minutes >= hours.dusk) return row.date;
	if (minutes < hours.dawn) return addDays(row.date, -1);
	return null;
}

export function afterDarkSightings(
	rows: NightRow[],
	place: StationPlace,
): Map<string, NightSighting> {
	const hoursByDay = new Map<string, DarkHours | null>();
	const found = new Map<
		string,
		{ nights: Set<string>; latest: string; best: number }
	>();
	for (const row of rows) {
		if (!hoursByDay.has(row.date))
			hoursByDay.set(row.date, darkHours(row.date, place));
		const hours = hoursByDay.get(row.date);
		if (!hours) continue;
		const night = nightOf(row, hours);
		if (!night) continue;
		const at = `${row.date} ${row.time}`;
		const seen = found.get(row.comName);
		if (!seen) {
			found.set(row.comName, {
				nights: new Set([night]),
				latest: at,
				best: row.confidence ?? 0,
			});
			continue;
		}
		seen.nights.add(night);
		if (at > seen.latest) seen.latest = at;
		seen.best = Math.max(seen.best, row.confidence ?? 0);
	}
	return new Map(
		Array.from(found, ([comName, seen]) => [
			comName,
			{
				nights: seen.nights.size,
				latest: seen.latest.slice(11, 16),
				best: seen.best,
			},
		]),
	);
}

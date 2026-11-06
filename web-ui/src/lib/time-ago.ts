const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function plural(value: number, unit: string): string {
	return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

export function formatTimeAgo(elapsedMs: number): string {
	if (elapsedMs < MINUTE) return "just now";
	if (elapsedMs < HOUR) return plural(Math.floor(elapsedMs / MINUTE), "minute");
	if (elapsedMs < DAY) return plural(Math.floor(elapsedMs / HOUR), "hour");
	if (elapsedMs < MONTH) return plural(Math.floor(elapsedMs / DAY), "day");
	if (elapsedMs < YEAR) return plural(Math.floor(elapsedMs / MONTH), "month");
	return plural(Math.floor(elapsedMs / YEAR), "year");
}

function formatClockTime(timestamp: string): string {
	const time = timestamp.slice(11);
	return new Date(`1970-01-01T${time}`).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

export function hourLabel(hour: number): string {
	if (hour === 0) return "12 AM";
	if (hour < 12) return `${hour} AM`;
	if (hour === 12) return "12 PM";
	return `${hour - 12} PM`;
}

export function formatClockRange(first: string, last: string): string {
	const start = formatClockTime(first);
	const end = formatClockTime(last);
	if (start === end) return end;
	const meridiem = /\s?[AaPp]\.?[Mm]\.?$/.exec(end)?.[0];
	if (meridiem && start.endsWith(meridiem)) {
		return `${start.slice(0, -meridiem.length)}–${end}`;
	}
	return `${start}–${end}`;
}

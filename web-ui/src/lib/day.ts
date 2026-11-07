import { localTimestamp } from "~/lib/visits.ts";

export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDayId(value: string): boolean {
	if (!DAY_PATTERN.test(value)) return false;
	const parsed = new Date(`${value}T00:00:00`);
	if (Number.isNaN(parsed.getTime())) return false;
	return dayIdFor(parsed) === value;
}

export function dayIdFor(date: Date): string {
	return localTimestamp(date).slice(0, 10);
}

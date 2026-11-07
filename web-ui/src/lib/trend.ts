import { dayIdFor } from "~/lib/day.ts";
import {
	buildHourActivity,
	buildMonthlyTrend,
	type HourActivity,
	type TrendPoint,
} from "~/lib/stats-data.ts";

export type { TrendPoint };

export type DayHourCount = { date: string; hour: string; count: number };

const ROLLING_YEAR_DAYS = 365;

function dayBuckets(daysBack: number): { key: string; label: string }[] {
	const now = new Date();
	const buckets: { key: string; label: string }[] = [];
	for (let i = daysBack - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const label = d.toLocaleDateString([], { month: "short", day: "numeric" });
		buckets.push({ key: dayIdFor(d), label });
	}
	return buckets;
}

function calendarDayBuckets(year: number): { key: string; label: string }[] {
	const buckets: { key: string; label: string }[] = [];
	const start = new Date(year, 0, 1);
	const daysInYear =
		(Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / (24 * 60 * 60 * 1000);

	for (let index = 0; index < daysInYear; index += 1) {
		const date = new Date(start);
		date.setDate(start.getDate() + index);
		const label = date.toLocaleDateString([], {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
		buckets.push({ key: dayIdFor(date), label });
	}

	return buckets;
}

function addTo<Key>(totals: Map<Key, number>, key: Key, count: number) {
	totals.set(key, (totals.get(key) ?? 0) + count);
}

export function deriveSpeciesTrends(
	rows: DayHourCount[],
	year: number,
): {
	availableYears: number[];
	history: TrendPoint[];
	detectionTrend: TrendPoint[];
	hourActivity: HourActivity[];
} {
	const byDate = new Map<string, number>();
	const byMonth = new Map<string, number>();
	const byHour = new Map<number, number>();
	const years = new Set<number>();
	for (const { date, hour, count } of rows) {
		addTo(byDate, date, count);
		addTo(byMonth, date.slice(5, 7), count);
		addTo(byHour, Number(hour), count);
		years.add(Number(date.slice(0, 4)));
	}

	const buckets =
		year === new Date().getFullYear()
			? dayBuckets(ROLLING_YEAR_DAYS)
			: calendarDayBuckets(year);

	return {
		availableYears: [...years].sort((a, b) => b - a),
		history: buckets.map(({ key, label }) => ({
			bucket: key,
			label,
			count: byDate.get(key) ?? 0,
		})),
		detectionTrend: buildMonthlyTrend(
			Array.from(byMonth, ([bucket, count]) => ({ bucket, count })),
		),
		hourActivity: buildHourActivity(
			Array.from(byHour, ([hour, count]) => ({ hour, count })),
		),
	};
}

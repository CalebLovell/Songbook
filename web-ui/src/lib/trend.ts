import { count, type SQL, sql } from "drizzle-orm";

import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { dayIdFor } from "~/lib/day.ts";
import {
	buildMonthlyTrend,
	type TrendBucketCount,
	type TrendPoint,
} from "~/lib/stats-data.ts";
import type { StatsPeriod } from "~/lib/stats-periods.ts";

export type { TrendPoint };

const PERIOD_HOURS: Record<StatsPeriod, number | null> = {
	year: 365 * 24,
	all: null,
};

function periodFilter(period: StatsPeriod): SQL {
	const hours = PERIOD_HOURS[period];
	if (hours === null) return sql`1=1`;
	return sql`datetime(${detections.Date} || ' ' || ${detections.Time}) >= datetime('now', ${`-${hours} hours`}, 'localtime')`;
}

function calendarYearFilter(year: number): SQL {
	return sql`${detections.Date} >= ${`${year}-01-01`} AND ${detections.Date} < ${`${year + 1}-01-01`}`;
}

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

const MAX_ALL_TIME_DAYS = 365;

async function daysSinceEarliestDetection(extraFilter?: SQL): Promise<number> {
	const query = db
		.select({ minDate: sql<string | null>`min(${detections.Date})` })
		.from(detections);
	const [row] = extraFilter ? await query.where(extraFilter) : await query;
	if (!row?.minDate) return 1;
	const earliest = new Date(`${row.minDate}T00:00:00`);
	const diffDays =
		Math.floor((Date.now() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1;
	return Math.min(MAX_ALL_TIME_DAYS, Math.max(1, diffDays));
}

async function getTrend(
	period: StatsPeriod,
	extraFilter?: SQL,
): Promise<TrendPoint[]> {
	const bucketExpr = sql<string>`${detections.Date}`;

	const where = extraFilter
		? sql`(${periodFilter(period)}) AND (${extraFilter})`
		: periodFilter(period);

	const rows = await db
		.select({ bucket: bucketExpr, count: count() })
		.from(detections)
		.where(where)
		.groupBy(bucketExpr);
	const countByBucket = new Map(rows.map((r) => [r.bucket, r.count]));

	const expected = dayBuckets(
		period === "year" ? 365 : await daysSinceEarliestDetection(extraFilter),
	);

	return expected.map(({ key, label }) => ({
		bucket: key,
		label,
		count: countByBucket.get(key) ?? 0,
	}));
}

async function getCalendarYearTrend(
	year: number,
	extraFilter?: SQL,
): Promise<TrendPoint[]> {
	const filter = calendarYearFilter(year);
	const where = extraFilter ? sql`(${filter}) AND (${extraFilter})` : filter;
	const bucketExpr = sql<string>`${detections.Date}`;
	const rows = await db
		.select({ bucket: bucketExpr, count: count() })
		.from(detections)
		.where(where)
		.groupBy(bucketExpr);
	const countByBucket = new Map(rows.map((row) => [row.bucket, row.count]));

	return calendarDayBuckets(year).map(({ key, label }) => ({
		bucket: key,
		label,
		count: countByBucket.get(key) ?? 0,
	}));
}

export async function getMonthlyTrend(
	extraFilter?: SQL,
): Promise<TrendPoint[]> {
	const bucketExpr = sql<string>`substr(${detections.Date}, 6, 2)`;
	const query = db
		.select({ bucket: bucketExpr, count: count() })
		.from(detections);

	const rows = await (extraFilter ? query.where(extraFilter) : query).groupBy(
		bucketExpr,
	);

	return buildMonthlyTrend(rows satisfies TrendBucketCount[]);
}

export async function getDetectionYears(extraFilter?: SQL): Promise<number[]> {
	const yearExpr = sql<number>`cast(substr(${detections.Date}, 1, 4) as integer)`;
	const query = db.select({ year: yearExpr }).from(detections);
	const rows = await (extraFilter ? query.where(extraFilter) : query)
		.groupBy(yearExpr)
		.orderBy(sql`${yearExpr} desc`);

	return rows.map((row) => row.year);
}

export async function getYearTrend(
	year: number,
	extraFilter?: SQL,
): Promise<TrendPoint[]> {
	if (year !== new Date().getFullYear()) {
		return getCalendarYearTrend(year, extraFilter);
	}

	return getTrend("year", extraFilter);
}

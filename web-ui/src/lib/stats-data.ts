export type HourActivity = { hour: number; count: number };
export type TrendBucketCount = { bucket: string; count: number };
export type TrendPoint = TrendBucketCount & { label: string };

const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

export function buildMonthlyTrend(rows: TrendBucketCount[]): TrendPoint[] {
	const countByBucket = new Map(rows.map((row) => [row.bucket, row.count]));

	return MONTH_LABELS.map((label, index) => {
		const bucket = (index + 1).toString().padStart(2, "0");
		return { bucket, label, count: countByBucket.get(bucket) ?? 0 };
	});
}

export function buildHourActivity(rows: HourActivity[]): HourActivity[] {
	const countByHour = new Map(rows.map((row) => [row.hour, row.count]));

	return Array.from({ length: 24 }, (_, hour) => ({
		hour,
		count: countByHour.get(hour) ?? 0,
	}));
}

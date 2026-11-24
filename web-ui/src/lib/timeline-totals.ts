import type { TimelineRow } from "~/lib/timeline.ts";

const HOURS = 24;

type TotalledRow = Pick<TimelineRow, "hourCounts" | "totalDetections">;

export function timelineTotals(rows: TotalledRow[]): {
	species: number;
	detections: number;
	peakHour: number | null;
} {
	const byHour = Array.from({ length: HOURS }, (_, hour) =>
		rows.reduce((sum, row) => sum + (row.hourCounts[hour] ?? 0), 0),
	);
	const busiest = Math.max(...byHour);
	return {
		species: rows.length,
		detections: rows.reduce((sum, row) => sum + row.totalDetections, 0),
		peakHour: busiest > 0 ? byHour.indexOf(busiest) : null,
	};
}

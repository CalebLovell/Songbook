import type { Highlight } from "~/lib/highlights-data.ts";
import { formatHighlightLines } from "~/lib/highlights-share.ts";
import { shareHeader, shareTotals } from "~/lib/share-card.ts";
import type { TimelinePeriod } from "~/lib/timeline-periods.ts";

const HOURS = 24;

const PERIOD_NOUN: Record<TimelinePeriod, string> = {
	day: "that day",
	week: "that week",
	month: "that month",
	year: "that year",
	all: "here",
};

export type TimelineShareRow = {
	comName: string;
	hourCounts: number[];
	totalDetections: number;
};

export type TimelineShareCard = {
	period: TimelinePeriod;
	heading: string[];
	rows: TimelineShareRow[];
	highlights: Highlight[];
	stationName?: string;
};

const MEDALS = ["🥇", "🥈", "🥉"] as const;

function hourTotals(rows: TimelineShareRow[]): number[] {
	const totals = Array.from({ length: HOURS }, () => 0);
	for (const row of rows) {
		for (let hour = 0; hour < HOURS; hour++) {
			totals[hour] += row.hourCounts[hour] ?? 0;
		}
	}
	return totals;
}

export function formatTimelineShareCard(card: TimelineShareCard): string {
	const { period, rows } = card;
	const header = shareHeader(card.heading, card.stationName);

	if (rows.length === 0) {
		return `${header}\n🤫  Nothing heard ${PERIOD_NOUN[period]}.`;
	}

	const detections = rows.reduce((sum, row) => sum + row.totalDetections, 0);
	const byHour = hourTotals(rows);

	const peakHour = byHour.reduce(
		(best, count, hour) => (count > byHour[best] ? hour : best),
		0,
	);

	const totals = shareTotals({
		species: rows.length,
		detections,
		peakHour: byHour[peakHour] > 0 ? peakHour : null,
		highlights: card.highlights,
	});

	const leaderboard = [...rows]
		.sort((a, b) => b.totalDetections - a.totalDetections)
		.slice(0, MEDALS.length)
		.map(
			(row, index) =>
				`${MEDALS[index]}  ${row.comName} · ${row.totalDetections.toLocaleString()}`,
		);

	const highlights: string[] = [];

	highlights.push(...formatHighlightLines(card.highlights));

	return [
		header,
		"",
		...totals,
		"",
		...leaderboard,
		...(highlights.length > 0 ? ["", ...highlights] : []),
	].join("\n");
}

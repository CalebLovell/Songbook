import type { Highlight } from "~/lib/highlights-data.ts";
import {
	formatActivityLines,
	formatHighlightLines,
} from "~/lib/highlights-share.ts";
import { plural } from "~/lib/number-format.ts";
import { hourLabel } from "~/lib/time-ago.ts";

type ShareWindow = "rolling" | "day";

export type ShareCard = {
	date: string;
	window?: ShareWindow;
	species: number;
	detections: number;
	topSpecies: { comName: string; count: number }[];
	busiestHour: { hour: number; count: number } | null;
	highlights?: Highlight[];
	heading?: string[];
	stationName?: string;
};

function dateLabel(date: string): string {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function shareHeader(
	[period, date]: string[],
	stationName?: string,
): string {
	return [
		"📖  Songbook",
		...(stationName ? [`📍  ${stationName}`] : []),
		`📅  ${[`${period} Summary`, ...(date ? [date] : [])].join(" · ")}`,
	].join("\n");
}

export function shareTotals({
	species,
	detections,
	peakHour,
	highlights,
}: {
	species: number;
	detections: number;
	peakHour: number | null;
	highlights: Highlight[];
}): string[] {
	return [
		`🐦  ${species.toLocaleString()} species · ${detections.toLocaleString()} ${plural(detections, "detection")}`,
		...(peakHour === null ? [] : [`🌅  Peak hour · ${hourLabel(peakHour)}`]),
		...formatActivityLines(highlights),
	];
}

export function shareTopBird(
	ranked: { comName: string; count: number }[],
): string[] {
	const [top] = ranked;
	return top ? [`🥇  ${top.comName} · ${top.count.toLocaleString()}`] : [];
}

export function formatShareCard(card: ShareCard): string {
	const window = card.window ?? "rolling";
	const header = shareHeader(
		card.heading ?? ["Last 24 hours", dateLabel(card.date)],
		card.stationName,
	);

	if (card.detections === 0) {
		const quiet =
			window === "day"
				? "Nothing heard all day."
				: "Nothing heard in the last 24 hours.";
		return `${header}\n🤫  ${quiet}`;
	}

	const totals = shareTotals({
		species: card.species,
		detections: card.detections,
		peakHour: card.busiestHour?.hour ?? null,
		highlights: card.highlights ?? [],
	});

	const highlights = formatHighlightLines(card.highlights ?? []);

	return [
		header,
		"",
		...totals,
		...shareTopBird(card.topSpecies),
		...(highlights.length > 0 ? ["", ...highlights] : []),
	].join("\n");
}

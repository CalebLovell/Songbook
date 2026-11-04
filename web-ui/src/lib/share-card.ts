import type { Highlight } from "~/lib/highlights-data.ts";
import {
	formatActivityLines,
	formatHighlightLines,
} from "~/lib/highlights-share.ts";
import { hourLabel } from "~/lib/time-ago.ts";

export type ShareWindow = "rolling" | "day";

export type ShareCard = {
	date: string;
	window?: ShareWindow;
	species: number;
	detections: number;
	topSpecies: { comName: string; count: number }[];
	busiestHour: { hour: number; count: number } | null;
	highlights?: Highlight[];
	heading?: string[];
};

function dateLabel(date: string): string {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function shareHeader([period, date]: string[]): string {
	return [
		"📖  Songbook",
		`📊  ${period} Summary`,
		...(date ? [`📅  ${date}`] : []),
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
		`🐦  Species · ${species.toLocaleString()}`,
		`🎙️  Detections · ${detections.toLocaleString()}`,
		...(peakHour === null ? [] : [`🌅  Peak hour · ${hourLabel(peakHour)}`]),
		...formatActivityLines(highlights),
	];
}

const MEDALS = ["🥇", "🥈", "🥉"] as const;

export function formatShareCard(card: ShareCard): string {
	const window = card.window ?? "rolling";
	const header = shareHeader(
		card.heading ?? ["Last 24 hours", dateLabel(card.date)],
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

	const leaderboard = card.topSpecies
		.slice(0, MEDALS.length)
		.map(
			(species, index) =>
				`${MEDALS[index]}  ${species.comName} · ${species.count.toLocaleString()}`,
		);

	const highlights = formatHighlightLines(card.highlights ?? []);

	return [
		header,
		"",
		...totals,
		...(leaderboard.length > 0 ? ["", ...leaderboard] : []),
		...(highlights.length > 0 ? ["", ...highlights] : []),
	].join("\n");
}

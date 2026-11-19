import type { Highlight } from "~/lib/highlights-data.ts";
import {
	activityLines,
	type ShareHighlightLine,
	speciesLines,
} from "~/lib/highlights-share.ts";
import { illustrationUrlFor, paintedBoundsFor } from "~/lib/illustrations.ts";
import { plural } from "~/lib/number-format.ts";
import type { PaintedBounds } from "~/lib/painted-species.ts";
import { PODIUM_SIZE, shareTitle } from "~/lib/share-card.ts";
import { hourLabel } from "~/lib/time-ago.ts";

export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1920;

export type ShareImageInput = {
	heading: string[];
	stationName?: string;
	species: number;
	detections: number;
	peakHour: number | null;
	birds: { comName: string; sciName: string; count: number }[];
	highlights: Highlight[];
};

export type ShareImageArt =
	| { kind: "painting"; url: string; bounds: PaintedBounds }
	| { kind: "photo"; url: string }
	| null;

export type ShareImageBird = {
	comName: string;
	count: number;
	countLabel: string;
	art: ShareImageArt;
};

export type ShareImageStat = { label: string; value: string };

export type ShareImageLine = ShareHighlightLine & { label: string };

export type ShareImageModel = {
	title: string;
	subtitle: string | null;
	stationName: string | null;
	podium: ShareImageBird[];
	stats: ShareImageStat[];
	lines: ShareImageLine[];
	fileName: string;
};

export function artFor(sciName: string): ShareImageArt {
	const url = illustrationUrlFor(sciName);
	if (!url) return null;
	const bounds = paintedBoundsFor(url);
	return bounds ? { kind: "painting", url, bounds } : { kind: "photo", url };
}

function imageBird(bird: ShareImageInput["birds"][number]): ShareImageBird {
	return {
		comName: bird.comName,
		count: bird.count,
		countLabel: `${bird.count.toLocaleString()} ${plural(bird.count, "detection")}`,
		art: artFor(bird.sciName),
	};
}

function fileSlug(parts: string[]): string {
	return parts
		.join(" ")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "");
}

export function buildShareImage(
	input: ShareImageInput,
): ShareImageModel | null {
	const podium = [...input.birds]
		.sort((a, b) => b.count - a.count)
		.slice(0, PODIUM_SIZE)
		.map(imageBird);
	if (podium.length === 0 || input.detections === 0) return null;

	const [period, date] = input.heading;
	return {
		title: shareTitle(period ?? ""),
		subtitle: date ?? null,
		stationName: input.stationName?.trim() || null,
		podium,
		stats: [
			{ label: "Species", value: input.species.toLocaleString() },
			{
				label: plural(input.detections, "Detection"),
				value: input.detections.toLocaleString(),
			},
			...(input.peakHour === null
				? []
				: [{ label: "Peak hour", value: hourLabel(input.peakHour) }]),
		],
		lines: [
			...activityLines(input.highlights),
			...speciesLines(input.highlights),
		].map((line) => ({ ...line, label: line.lead ?? "Activity" })),
		fileName: `${fileSlug(["songbook", ...input.heading]) || "songbook"}.png`,
	};
}

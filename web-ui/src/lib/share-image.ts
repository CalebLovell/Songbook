import {
	collageBirdsFrom,
	collagePhotosFrom,
	type ShownCollageBird,
	showCollageBirds,
} from "~/lib/collage-birds.ts";
import type {
	Highlight,
	HighlightBird,
	SpeciesHighlightKind,
} from "~/lib/highlights-data.ts";
import { illustrationUrlFor, paintedBoundsFor } from "~/lib/illustrations.ts";
import { plural } from "~/lib/number-format.ts";
import type { PaintedBounds } from "~/lib/painted-species.ts";
import { hourLabel } from "~/lib/time-ago.ts";
import { periodTitle } from "~/lib/timeline-periods.ts";

export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1920;
const TOP_BIRDS = 5;

const HIGHLIGHT_LABELS: Record<SpeciesHighlightKind, string> = {
	new: "New",
	rare: "Rare",
	vocal: "Vocal",
	consistent: "Regular",
	returned: "Returned",
	"after-dark": "After dark",
	routine: "Gone quiet",
};

export type ShareImageInput = {
	heading: string[];
	stationName?: string;
	species: number;
	detections: number;
	peakHour: number | null;
	birds: { comName: string; sciName: string; count: number }[];
	highlights: Highlight[];
	highlightSciNames: Record<string, string>;
};

export type ShareImageArt =
	| { kind: "painting"; url: string; bounds: PaintedBounds }
	| { kind: "photo"; url: string }
	| null;

export type ShareImageRow = { comName: string; art: ShareImageArt } & (
	| { kind: "count"; count: string }
	| { kind: "highlight"; label: string }
);

export type ShareImageStat = { label: string; value: string };

export type ShareImageModel = {
	title: string;
	stationName: string | null;
	collage: ShownCollageBird[];
	rows: ShareImageRow[];
	stats: ShareImageStat[];
	alt: string;
	fileName: string;
};

export type ShareImages = {
	topBirds: ShareImageModel;
	highlights: ShareImageModel | null;
};

export function artFor(sciName: string): ShareImageArt {
	const url = illustrationUrlFor(sciName);
	if (!url) return null;
	const bounds = paintedBoundsFor(url);
	return bounds ? { kind: "painting", url, bounds } : { kind: "photo", url };
}

function busiestRows(birds: ShareImageInput["birds"]): ShareImageRow[] {
	return [...birds]
		.sort((a, b) => b.count - a.count)
		.slice(0, TOP_BIRDS)
		.map(({ comName, sciName, count }) => ({
			kind: "count",
			comName,
			count: count.toLocaleString(),
			art: artFor(sciName),
		}));
}

type SpeciesHighlight = {
	kind: SpeciesHighlightKind;
	birds: HighlightBird[];
};

function leadBirds(
	highlights: SpeciesHighlight[],
): Map<SpeciesHighlightKind, string> {
	const leads = new Map<SpeciesHighlightKind, string>();
	const taken = new Set<string>();
	const fewestChoicesFirst = [...highlights].sort(
		(a, b) => a.birds.length - b.birds.length,
	);
	for (const { kind, birds } of fewestChoicesFirst) {
		const lead = birds.find((bird) => !taken.has(bird.comName)) ?? birds[0];
		taken.add(lead.comName);
		leads.set(kind, lead.comName);
	}
	return leads;
}

function highlightRows({
	highlights,
	highlightSciNames,
}: ShareImageInput): ShareImageRow[] {
	const named = highlights.flatMap((highlight) =>
		"birds" in highlight && highlight.birds.length > 0 ? [highlight] : [],
	);
	const leads = leadBirds(named);
	return named.flatMap(({ kind }) => {
		const comName = leads.get(kind);
		if (!comName) return [];
		const sciName = highlightSciNames[comName];
		return [
			{
				kind: "highlight" as const,
				label: HIGHLIGHT_LABELS[kind],
				comName,
				art: sciName ? artFor(sciName) : null,
			},
		];
	});
}

function collageFor(
	birds: ShareImageInput["birds"],
	mixSeed: number,
): ShownCollageBird[] {
	const painted = collageBirdsFrom(birds);
	return painted.length > 0
		? showCollageBirds(painted, mixSeed)
		: collagePhotosFrom(birds);
}

function fileSlug(parts: string[]): string {
	return parts
		.join(" ")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, "-")
		.replaceAll(/^-|-$/g, "");
}

function rowAlt(row: ShareImageRow): string {
	return row.kind === "count"
		? `${row.comName} ${row.count}`
		: `${row.label}: ${row.comName}`;
}

export function buildShareImages(
	input: ShareImageInput,
	mixSeed: number,
): ShareImages | null {
	if (input.birds.length === 0 || input.detections === 0) return null;

	const shared = {
		title: periodTitle(input.heading),
		stationName: input.stationName?.trim() || null,
		collage: collageFor(input.birds, mixSeed),
		stats: [
			{
				label: plural(input.detections, "Detection"),
				value: input.detections.toLocaleString(),
			},
			{ label: "Species", value: input.species.toLocaleString() },
			...(input.peakHour === null
				? []
				: [{ label: "Peak hour", value: hourLabel(input.peakHour) }]),
		],
	};
	const image = (rows: ShareImageRow[], nameParts: string[]) => ({
		...shared,
		rows,
		alt: [
			shared.title,
			rows.map(rowAlt).join(", "),
			shared.stats.map(({ label, value }) => `${label} ${value}`).join(", "),
		].join(". "),
		fileName: `${fileSlug(["songbook", ...input.heading, ...nameParts])}.png`,
	});

	const highlights = highlightRows(input);
	return {
		topBirds: image(busiestRows(input.birds), ["top", "birds"]),
		highlights:
			highlights.length > 0 ? image(highlights, ["highlights"]) : null,
	};
}

import type { Highlight, SpeciesHighlightKind } from "~/lib/highlights-data.ts";

type ActivityDirection = Extract<Highlight, { kind: "activity" }>["direction"];

const SPECIES_LEADS: Record<
	SpeciesHighlightKind,
	{ emoji: string; name: string }
> = {
	new: { emoji: "🐣", name: "New" },
	rare: { emoji: "💎", name: "Rare" },
	consistent: { emoji: "🏠", name: "Regulars" },
	routine: { emoji: "🤐", name: "Gone quiet" },
	returned: { emoji: "🔁", name: "Returned" },
	vocal: { emoji: "📣", name: "Vocal" },
	"after-dark": { emoji: "🌙", name: "After dark" },
};

const ACTIVITY_EMOJI: Record<ActivityDirection, string> = {
	up: "📈",
	down: "📉",
	level: "➡️",
};

export type ShareHighlightLine = {
	emoji: string;
	lead: string | null;
	bird: string | null;
	text: string;
};

export function activityLines(highlights: Highlight[]): ShareHighlightLine[] {
	return highlights.flatMap((highlight) => {
		if (highlight.kind !== "activity") return [];
		const { direction, percent, baselineLabel } = highlight;
		const text =
			direction === "level"
				? `The same as ${baselineLabel}`
				: `${direction === "up" ? "Up" : "Down"} ${percent}% from ${baselineLabel}`;
		return [{ emoji: ACTIVITY_EMOJI[direction], lead: null, bird: null, text }];
	});
}

export function speciesLines(highlights: Highlight[]): ShareHighlightLine[] {
	return highlights.flatMap((highlight) => {
		if (!("birds" in highlight)) return [];
		const [lead] = highlight.birds;
		if (!lead) return [];
		const more = highlight.total - 1;
		const { emoji, name } = SPECIES_LEADS[highlight.kind];
		return [
			{
				emoji,
				lead: name,
				bird: lead.comName,
				text: `${lead.comName}${more > 0 ? ` +${more.toLocaleString()}` : ""}`,
			},
		];
	});
}

export function formatShareLine({ emoji, lead, text }: ShareHighlightLine) {
	return `${emoji}  ${lead ? `${lead} · ` : ""}${text}`;
}

export function formatActivityLines(highlights: Highlight[]): string[] {
	return activityLines(highlights).map(formatShareLine);
}

export function formatHighlightLines(highlights: Highlight[]): string[] {
	return speciesLines(highlights).map(formatShareLine);
}

import type { Highlight, SpeciesHighlightKind } from "~/lib/highlights-data.ts";

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

export function formatActivityLines(highlights: Highlight[]): string[] {
	return highlights.flatMap((highlight) => {
		if (highlight.kind !== "activity") return [];
		const { direction, percent, baselineLabel } = highlight;
		if (direction === "level") return [`➡️  The same as ${baselineLabel}`];
		return [
			`${direction === "up" ? "📈  Up" : "📉  Down"} ${percent}% from ${baselineLabel}`,
		];
	});
}

export function formatHighlightLines(highlights: Highlight[]): string[] {
	return highlights.flatMap((highlight) => {
		if (!("birds" in highlight)) return [];
		const [lead] = highlight.birds;
		if (!lead) return [];
		const { emoji, name } = SPECIES_LEADS[highlight.kind];
		const rest = highlight.total - 1;
		return [
			`${emoji}  ${name} · ${lead.comName}${rest > 0 ? ` +${rest.toLocaleString()}` : ""}`,
		];
	});
}

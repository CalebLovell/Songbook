import type { Highlight, SpeciesHighlightKind } from "~/lib/highlights-data.ts";

const MAX_SHARED_NAMES = 3;

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
	const blocks = highlights.flatMap((highlight) => {
		if (!("birds" in highlight)) return [];
		const { emoji, name } = SPECIES_LEADS[highlight.kind];
		const named = highlight.birds.slice(0, MAX_SHARED_NAMES).map((bird) => {
			const note = bird.shareNote ?? bird.note;
			return note ? `${bird.comName} (${note})` : bird.comName;
		});
		const rest = highlight.total - named.length;
		return [
			[
				`${emoji}  ${name} · ${highlight.total.toLocaleString()}`,
				...named,
				...(rest > 0 ? [`+${rest} more`] : []),
			],
		];
	});
	return blocks.flatMap((block, index) => (index > 0 ? ["", ...block] : block));
}

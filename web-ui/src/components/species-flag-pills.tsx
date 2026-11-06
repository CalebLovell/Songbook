import { AudioLines, Gem, House, Sparkles, Undo2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Pill } from "~/components/pill.tsx";
import { formatDate } from "~/lib/date-format.ts";
import {
	formatRate,
	type SpeciesHighlightKind,
	type VocalJump,
	windowPhrase,
} from "~/lib/highlights-data.ts";

function B({ children }: { children: ReactNode }) {
	return <strong>{children}</strong>;
}

function withBoldNumbers(text: string): ReactNode {
	return text.split(/(\d+(?:[.,]\d+)*%?)/).map((part, i) =>
		// biome-ignore lint/suspicious/noArrayIndexKey: a fixed sentence, never reordered
		i % 2 === 1 ? <B key={i}>{part}</B> : part,
	);
}

function newTooltip(firstHeard: string | null): ReactNode {
	if (firstHeard == null) return "First recorded here.";
	return (
		<>
			First recorded here on <B>{formatDate(firstHeard)}</B>.
		</>
	);
}

function consistentTooltip(note: string | null): ReactNode {
	if (note == null) return "Heard here day in, day out.";
	return withBoldNumbers(
		note.endsWith("of days") ? `Heard on ${note}.` : `Heard ${note}.`,
	);
}

function returnedTooltip(away: string | null): ReactNode {
	if (away == null) return "Back after time missing.";
	return withBoldNumbers(`Back after ${away} missing.`);
}

function vocalTooltip({
	count,
	usual,
	period,
}: Pick<VocalJump, "count" | "usual" | "period">): ReactNode {
	const times = count === 1 ? "time" : "times";
	return (
		<>
			Heard <B>{formatRate(count)}</B> {times} {windowPhrase(period)}, usually
			only <B>{formatRate(usual)}</B>.
		</>
	);
}

function flagTip(name: string, meaning: ReactNode): ReactNode {
	return (
		<>
			<B>{name}</B> — {meaning}
		</>
	);
}

const NEW_PILL_STYLE: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #3f6ea6 20%, var(--paper-raised))",
	color: "#2a4d78",
};

const RETURNED_PILL_STYLE: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #a8536e 20%, var(--paper-raised))",
	color: "#733a4e",
};

const RARE_PILL_STYLE: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #6f5c9c 22%, var(--paper-raised))",
	color: "#463a73",
};

const CONSISTENT_PILL_STYLE: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #2f7d6d 20%, var(--paper-raised))",
	color: "#1f5248",
};

const VOCAL_PILL_STYLE: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #b07a1f 22%, var(--paper-raised))",
	color: "#6e4a10",
};

export const BADGE_STYLES = {
	new: NEW_PILL_STYLE,
	rare: RARE_PILL_STYLE,
	consistent: CONSISTENT_PILL_STYLE,
	returned: RETURNED_PILL_STYLE,
	vocal: VOCAL_PILL_STYLE,
} satisfies Partial<Record<SpeciesHighlightKind, CSSProperties>>;

export function SpeciesFlagPills({
	isNew,
	isRare,
	isConsistent,
	regularNote,
	isReturned,
	firstHeard,
	away,
	vocal,
}: {
	isNew: boolean;
	isRare: boolean;
	isConsistent: boolean;
	regularNote: string | null;
	isReturned: boolean;
	away: string | null;
	vocal: VocalJump | null;
	firstHeard: string | null;
}) {
	return (
		<>
			{isNew ? (
				<Pill
					icon={Sparkles}
					label="New"
					style={NEW_PILL_STYLE}
					tooltip={flagTip("New", newTooltip(firstHeard))}
					iconOnly
				/>
			) : null}
			{isRare ? (
				<Pill
					icon={Gem}
					label="Rare"
					style={RARE_PILL_STYLE}
					tooltip={flagTip("Rare", "Barely ever heard here.")}
					iconOnly
				/>
			) : null}
			{vocal != null ? (
				<Pill
					icon={AudioLines}
					label="Vocal"
					style={VOCAL_PILL_STYLE}
					tooltip={flagTip("Vocal", vocalTooltip(vocal))}
					iconOnly
				/>
			) : null}
			{isReturned ? (
				<Pill
					icon={Undo2}
					label="Returned"
					style={RETURNED_PILL_STYLE}
					tooltip={flagTip("Returned", returnedTooltip(away))}
					iconOnly
				/>
			) : null}
			{isConsistent ? (
				<Pill
					icon={House}
					label="Regular"
					style={CONSISTENT_PILL_STYLE}
					tooltip={flagTip("Regular", consistentTooltip(regularNote))}
					iconOnly
				/>
			) : null}
		</>
	);
}

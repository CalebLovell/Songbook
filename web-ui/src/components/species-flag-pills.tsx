import { AudioLines, Gem, House, Moon, Sparkles, Undo2 } from "lucide-react";
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

function afterDarkTooltip(note: string): ReactNode {
	return withBoldNumbers(
		`Heard after dark ${note.startsWith("at ") ? note : `on ${note}`}.`,
	);
}

function flagTip(name: string, meaning: ReactNode): ReactNode {
	return (
		<>
			<B>{name}</B> — {meaning}
		</>
	);
}

export function hueTint(
	hue: string,
	lightText: string,
	share: number,
): CSSProperties {
	return {
		backgroundColor: `color-mix(in oklab, ${hue} ${share}%, var(--paper-raised))`,
		color: `light-dark(${lightText}, color-mix(in oklab, ${hue} 45%, white))`,
	};
}

const NEW_PILL_STYLE: CSSProperties = hueTint("#3f6ea6", "#2a4d78", 20);

const RETURNED_PILL_STYLE: CSSProperties = hueTint("#a8536e", "#733a4e", 20);

const RARE_PILL_STYLE: CSSProperties = hueTint("#6f5c9c", "#463a73", 22);

const CONSISTENT_PILL_STYLE: CSSProperties = hueTint("#2f7d6d", "#1f5248", 20);

const VOCAL_PILL_STYLE: CSSProperties = hueTint("#b07a1f", "#6e4a10", 22);

const AFTER_DARK_PILL_STYLE: CSSProperties = hueTint("#3b4a8a", "#28336a", 22);

export const BADGE_STYLES = {
	new: NEW_PILL_STYLE,
	rare: RARE_PILL_STYLE,
	consistent: CONSISTENT_PILL_STYLE,
	returned: RETURNED_PILL_STYLE,
	vocal: VOCAL_PILL_STYLE,
	"after-dark": AFTER_DARK_PILL_STYLE,
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
	afterDark,
}: {
	isNew: boolean;
	isRare: boolean;
	isConsistent: boolean;
	regularNote: string | null;
	isReturned: boolean;
	away: string | null;
	vocal: VocalJump | null;
	afterDark: string | null;
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
			{afterDark != null ? (
				<Pill
					icon={Moon}
					label="After dark"
					style={AFTER_DARK_PILL_STYLE}
					tooltip={flagTip("After dark", afterDarkTooltip(afterDark))}
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

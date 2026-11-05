import {
	AudioLines,
	Clock,
	Gem,
	House,
	type LucideIcon,
	MoveRight,
	Sparkles,
	TrendingDown,
	TrendingUp,
	Undo2,
	VolumeX,
} from "lucide-react";
import { type CSSProperties, Fragment, type ReactNode } from "react";
import { CardHeader } from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { GLYPH_CHIP_SIZE, GlyphChip } from "~/components/glyph-chip.tsx";
import { BADGE_STYLES } from "~/components/species-flag-pills.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import { ShellBar, ShellText } from "~/components/ui/shell.tsx";
import {
	type HighlightGuideEntry,
	type HighlightPeriod,
	type HighlightThresholds,
	highlightGuide,
} from "~/lib/highlight-thresholds.ts";
import type {
	Highlight,
	HighlightBird,
	SpeciesHighlightKind,
} from "~/lib/highlights-data.ts";
import { hourLabel } from "~/lib/time-ago.ts";

export function HighlightsCard({
	highlights,
	emptyMessage,
	period,
	thresholds,
	className = "",
}: {
	highlights: Highlight[] | null;
	emptyMessage: string;
	period?: HighlightPeriod;
	thresholds?: HighlightThresholds;
	className?: string;
}) {
	const guide = period ? highlightGuide(period, thresholds) : [];
	return (
		<section
			aria-label="Highlights"
			className={`feature-card rounded-md p-4 ${className}`}
		>
			<CardHeader title="Highlights">
				{period ? <HighlightsInfo guide={guide} /> : null}
			</CardHeader>

			{highlights === null ? (
				<PendingNotes />
			) : highlights.length === 0 ? (
				<EmptyNote>{emptyMessage}</EmptyNote>
			) : (
				<ul className={NOTES_CLASS}>
					{highlights.map((highlight) => (
						<HighlightNote
							key={highlight.kind}
							highlight={highlight}
							tip={guide.find((entry) => entry.kind === highlight.kind)}
						/>
					))}
				</ul>
			)}
		</section>
	);
}

const PENDING_NOTES = [["w-4/5"], ["w-1/3"], ["w-3/4"], ["w-3/5"]];

function PendingNotes() {
	return (
		<ul
			aria-busy="true"
			aria-label="Loading highlights"
			className={NOTES_CLASS}
		>
			{PENDING_NOTES.map((lines, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
				<li key={index} className={NOTE_CLASS}>
					<ShellBar className={`${GLYPH_CHIP_SIZE} shrink-0 rounded-full`} />
					<span className="min-w-0 flex-1">
						{lines.map((width, line) => (
							<ShellText
								// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
								key={line}
								className="text-[13px] leading-normal"
								barClassName={width}
							/>
						))}
					</span>
				</li>
			))}
		</ul>
	);
}

function HighlightsInfo({ guide }: { guide: HighlightGuideEntry[] }) {
	return (
		<InfoTip label="Highlights" size="default">
			<ul className="space-y-2">
				{guide.map((entry) => {
					const { icon, badge } = guideGlyph(entry.kind);
					return (
						<li key={entry.name} className="flex items-center gap-2.5">
							<GlyphChip icon={icon} style={badge} />
							<span className="min-w-0">
								<strong>{entry.name}:</strong> {entry.meaning}
							</span>
						</li>
					);
				})}
			</ul>
		</InfoTip>
	);
}

type SpeciesLine = Extract<Highlight, { kind: SpeciesHighlightKind }>;

const UP_TINT: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #6b8a3a 22%, var(--paper-raised))",
	color: "#3d5220",
};
const DOWN_TINT: CSSProperties = {
	backgroundColor: "color-mix(in oklab, #c4524a 20%, var(--paper-raised))",
	color: "#7d2a24",
};
const LINE_TINTS: Record<
	Exclude<Highlight["kind"], "activity">,
	CSSProperties
> = {
	...BADGE_STYLES,
	"busiest-hour": {
		backgroundColor: "color-mix(in oklab, #c8703c 22%, var(--paper-raised))",
		color: "#7a3f1c",
	},
	routine: {
		backgroundColor: "color-mix(in oklab, #5f6f82 20%, var(--paper-raised))",
		color: "#3a4654",
	},
};

const SPECIES_NOTES: Record<
	SpeciesHighlightKind,
	{ icon: LucideIcon; lead: (line: SpeciesLine) => string }
> = {
	new: { icon: Sparkles, lead: () => "new" },
	rare: { icon: Gem, lead: () => "rare" },
	consistent: {
		icon: House,
		lead: ({ total }) => (total === 1 ? "regular" : "regulars"),
	},
	routine: { icon: VolumeX, lead: () => "gone quiet" },
	returned: { icon: Undo2, lead: () => "returned" },
	vocal: { icon: AudioLines, lead: () => "vocal" },
};

function guideGlyph(kind: Highlight["kind"]): {
	icon: LucideIcon;
	badge: CSSProperties;
} {
	if (kind === "activity") return { icon: TrendingUp, badge: UP_TINT };
	if (kind === "busiest-hour")
		return { icon: Clock, badge: LINE_TINTS["busiest-hour"] };
	return { icon: SPECIES_NOTES[kind].icon, badge: LINE_TINTS[kind] };
}

function HighlightNote({
	highlight,
	tip,
}: {
	highlight: Highlight;
	tip?: HighlightGuideEntry;
}) {
	switch (highlight.kind) {
		case "activity":
			return <ActivityNote highlight={highlight} tip={tip} />;
		case "busiest-hour":
			return (
				<Note icon={Clock} badge={LINE_TINTS["busiest-hour"]} tip={tip}>
					Busiest at <Figure>{hourLabel(highlight.hour)}</Figure>.
				</Note>
			);
		default: {
			const { icon, lead } = SPECIES_NOTES[highlight.kind];
			return (
				<Note icon={icon} badge={LINE_TINTS[highlight.kind]} tip={tip}>
					<Figure>{highlight.total}</Figure> {lead(highlight)}:{" "}
					<BirdNames birds={highlight.birds} total={highlight.total} />.
				</Note>
			);
		}
	}
}

function ActivityNote({
	highlight,
	tip,
}: {
	highlight: Extract<Highlight, { kind: "activity" }>;
	tip?: HighlightGuideEntry;
}) {
	const { direction, percent, baselineLabel, count, delta } = highlight;
	const noun = (n: number) => (n === 1 ? "detection" : "detections");

	return (
		<Note
			tip={tip}
			icon={
				direction === "up"
					? TrendingUp
					: direction === "down"
						? TrendingDown
						: MoveRight
			}
			badge={
				direction === "up"
					? UP_TINT
					: direction === "down"
						? DOWN_TINT
						: undefined
			}
		>
			{direction === "level" ? (
				<>
					The same as {baselineLabel}: <Figure>{count.toLocaleString()}</Figure>{" "}
					{noun(count)}
				</>
			) : (
				<>
					{direction === "up" ? "Up" : "Down"} <Figure>{percent}%</Figure> from{" "}
					{baselineLabel}: <Figure>{Math.abs(delta).toLocaleString()}</Figure>{" "}
					{delta > 0 ? "more" : "fewer"} {noun(Math.abs(delta))}
				</>
			)}
			.
		</Note>
	);
}

const NOTE_CLASS =
	"flex items-center gap-2.5 border-line border-t px-page py-2.5 text-[13px] leading-normal first:border-t-0 first:pt-1.5 last:pb-0 max-[400px]:gap-2";

const NOTES_CLASS = "-mx-page mt-2";

function Note({
	icon: Icon,
	badge,
	tip,
	children,
}: {
	icon: LucideIcon;
	badge?: CSSProperties;
	tip?: HighlightGuideEntry;
	children: ReactNode;
}) {
	return (
		<li className={NOTE_CLASS}>
			{tip ? (
				<GlyphChip
					icon={Icon}
					style={badge}
					interactive
					label={`About ${tip.name}`}
					tooltipClassName="max-w-80 leading-relaxed"
					tooltip={
						<>
							<strong>{tip.name}:</strong> {tip.meaning}
						</>
					}
				/>
			) : (
				<GlyphChip icon={Icon} style={badge} />
			)}
			<span className="min-w-0">{children}</span>
		</li>
	);
}

function BirdNames({
	birds,
	total,
}: {
	birds: HighlightBird[];
	total: number;
}) {
	const rest = total - birds.length;
	return (
		<>
			{birds.map((bird, i) => (
				<Fragment key={bird.comName}>
					{i === 0
						? null
						: rest === 0 && i === birds.length - 1
							? " and "
							: ", "}
					{bird.comName}
				</Fragment>
			))}
			{rest > 0 ? ` and ${rest} more` : null}
		</>
	);
}

function Figure({ children }: { children: ReactNode }) {
	return <span className="count-figure">{children}</span>;
}

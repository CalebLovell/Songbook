import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CARD_HEADER_CLASS } from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { SpeciesFlagPills } from "~/components/species-flag-pills.tsx";
import {
	SpeciesHourBars,
	SpeciesHourBarsSkeleton,
} from "~/components/species-hour-bars.tsx";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import { Card } from "~/components/ui/card.tsx";
import { COUNT_CLASS, Count } from "~/components/ui/count.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { ShellBar, ShellText } from "~/components/ui/shell.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import type { VocalJump } from "~/lib/highlights-data.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { cn } from "~/lib/utils.ts";

export type SpeciesGridItem = {
	comName: string;
	sciName: string;
	imageUrl: string | null;
	count: number;
	isNew: boolean;
	firstHeard: string | null;
	isRare: boolean;
	isConsistent: boolean;
	regularNote: string | null;
	isReturned: boolean;
	away: string | null;
	vocal: VocalJump | null;
	afterDark: string | null;
	hourCounts?: number[];
};

const LIST_CLASS =
	"grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3";
const TILE_CLASS =
	"flex min-h-16 min-w-0 flex-col gap-2 rounded-md bg-meadow px-3 py-2 max-[400px]:px-2";

export function SpeciesGrid({
	species,
	emptyMessage,
	emptyAction,
	summary,
	className = "",
}: {
	species: SpeciesGridItem[];
	emptyMessage: string;
	emptyAction?: ReactNode;
	summary?: ReactNode;
	className?: string;
}) {
	return (
		<TooltipProvider>
			<Card as="section" aria-label="Species" className={className}>
				<div className={`${CARD_HEADER_CLASS} mb-page gap-3 py-2`}>
					<div className="flex h-[1.035rem] min-w-0 items-center gap-3">
						<Kicker as="h2" className="shrink-0">
							Activity
						</Kicker>
						{summary}
					</div>
				</div>

				{species.length === 0 ? (
					<>
						<EmptyNote>{emptyMessage}</EmptyNote>
						{emptyAction ? <div className="mt-3">{emptyAction}</div> : null}
					</>
				) : (
					<ul className={LIST_CLASS}>
						{species.map((item) => (
							<SpeciesGridRow key={item.comName} item={item} />
						))}
					</ul>
				)}
			</Card>
		</TooltipProvider>
	);
}

function SpeciesGridRow({ item }: { item: SpeciesGridItem }) {
	return (
		<li className={TILE_CLASS}>
			<div className="flex min-w-0 items-center gap-3 max-[400px]:gap-2">
				<SpeciesThumbnail imageUrl={item.imageUrl} comName={item.comName} />

				<div className="min-w-0 flex-1">
					<Link
						to="/birds/$comName"
						preload={false}
						params={{ comName: comNameToSlug(item.comName) }}
						className="block max-w-fit truncate font-medium no-underline hover:underline"
					>
						{item.comName}
					</Link>
					<div className="truncate text-bark text-xs italic">
						{item.sciName}
					</div>
				</div>

				<div className="flex shrink-0 flex-col items-end gap-1.5">
					<Count>{item.count.toLocaleString()}</Count>
					<div className="flex flex-wrap items-center justify-end gap-1.5">
						<SpeciesFlagPills
							isNew={item.isNew}
							isReturned={item.isReturned}
							isRare={item.isRare}
							isConsistent={item.isConsistent}
							regularNote={item.regularNote}
							away={item.away}
							vocal={item.vocal}
							afterDark={item.afterDark}
							firstHeard={item.firstHeard}
						/>
					</div>
				</div>
			</div>

			{item.hourCounts ? (
				<SpeciesHourBars
					comName={item.comName}
					hourCounts={item.hourCounts}
					className="border-line border-t pt-2"
				/>
			) : null}
		</li>
	);
}

const NAME_WIDTHS = ["w-32", "w-24", "w-36", "w-28"];
const SKELETON_TILES = 9;

export function SpeciesGridSkeleton({
	summary,
	className = "",
}: {
	summary?: ReactNode;
	className?: string;
}) {
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label="Species"
			className={className}
		>
			<div className={`${CARD_HEADER_CLASS} mb-page gap-3 py-2`}>
				<div className="flex h-[1.035rem] min-w-0 items-center gap-3">
					<Kicker as="h2" className="shrink-0">
						Activity
					</Kicker>
					{summary}
				</div>
			</div>
			<ul aria-hidden="true" className={LIST_CLASS}>
				{Array.from({ length: SKELETON_TILES }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
					<li key={index} className={TILE_CLASS}>
						<div className="flex min-w-0 items-center gap-3 max-[400px]:gap-2">
							<div className="flex size-10 shrink-0 items-center justify-center">
								<ShellBar className="size-9 rounded-md" />
							</div>
							<div className="min-w-0 flex-1">
								<ShellText
									className="font-medium"
									barClassName={NAME_WIDTHS[index % NAME_WIDTHS.length]}
								/>
								<ShellText className="text-xs" barClassName="w-24" />
							</div>
							<div className="flex shrink-0 flex-col items-end gap-1.5">
								<ShellText
									className={cn(COUNT_CLASS, "w-10")}
									barClassName="right-0 left-auto w-8"
								/>
							</div>
						</div>
						<SpeciesHourBarsSkeleton className="border-line border-t pt-2" />
					</li>
				))}
			</ul>
		</Card>
	);
}

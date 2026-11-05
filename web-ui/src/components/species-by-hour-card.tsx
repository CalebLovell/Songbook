import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CARD_HEADER_CLASS } from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { SpeciesFlagPills } from "~/components/species-flag-pills.tsx";
import { SpeciesImage } from "~/components/species-image.tsx";
import { Card } from "~/components/ui/card.tsx";
import { COUNT_CLASS, Count } from "~/components/ui/count.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { ShellBar, ShellText } from "~/components/ui/shell.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import { heatColor, heatInk, heatMaximum } from "~/lib/heatmap.ts";
import type { VocalJump } from "~/lib/highlights-data.ts";
import { compactCount } from "~/lib/number-format.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { hourLabel } from "~/lib/time-ago.ts";
import { cn } from "~/lib/utils.ts";

export type SpeciesHourRow = {
	comName: string;
	imageUrl: string | null;
	hourCounts: number[];
	totalDetections: number;
	isNew: boolean;
	firstHeard: string | null;
	isReturned: boolean;
	isRare: boolean;
	isConsistent: boolean;
	regularNote: string | null;
	away: string | null;
	vocal: VocalJump | null;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const ROW_LAYOUT = "flex items-center";

const LABEL_LAYOUT =
	"grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 max-[400px]:gap-2 @min-[56rem]/card:pr-6";

const BIRD_BOX_CLASS =
	"me-[calc(var(--page-gap)-0.5rem)] flex size-6 shrink-0 items-center justify-center";

const HOURS_LAYOUT = "hidden flex-none @min-[56rem]/card:block";

const HOUR_GRID_COLUMNS = "repeat(24, 1.75rem)";

const EMPTY_CELL_COLOR =
	"color-mix(in oklab, var(--moss) 4%, var(--paper-raised))";

function hourTickParts(hour: number): { number: string; meridiem: string } {
	if (hour === 0) return { number: "12", meridiem: "a" };
	if (hour < 12) return { number: String(hour), meridiem: "a" };
	if (hour === 12) return { number: "12", meridiem: "p" };
	return { number: String(hour - 12), meridiem: "p" };
}

export function SpeciesByHourCard({
	rows,
	emptyMessage,
	emptyAction,
	summary,
	className = "",
}: {
	rows: SpeciesHourRow[];
	emptyMessage: string;
	emptyAction?: ReactNode;
	summary?: ReactNode;
	className?: string;
}) {
	const isEmpty = rows.length === 0;
	const heatMax = heatMaximum(rows);

	return (
		<TooltipProvider>
			<Card
				as="section"
				aria-label="Species by hour"
				className={`@container/card ${isEmpty ? "" : "pb-1!"} ${className}`}
			>
				<div
					className={`${CARD_HEADER_CLASS} gap-3 py-2 max-[480px]:flex-wrap max-[480px]:gap-y-2 ${isEmpty ? "mb-page" : ""}`}
				>
					<div className="flex h-[calc(0.69rem*1.5)] min-w-0 items-center gap-3 max-[480px]:contents">
						<Kicker className="shrink-0">Activity</Kicker>
						{summary}
					</div>
				</div>

				{isEmpty ? (
					<>
						<EmptyNote>{emptyMessage}</EmptyNote>
						{emptyAction ? <div className="mt-3">{emptyAction}</div> : null}
					</>
				) : (
					<div className="-mx-1 px-1">
						<HeaderRow />

						<div className="-mx-page [&>*]:px-page">
							{rows.map((row) => (
								<SpeciesHourRowView
									key={row.comName}
									row={row}
									heatMax={heatMax}
								/>
							))}
						</div>
					</div>
				)}
			</Card>
		</TooltipProvider>
	);
}

function HeaderRow() {
	return (
		<div className={`${ROW_LAYOUT} py-2`}>
			<div className={`h-4 ${LABEL_LAYOUT}`}>
				<span />
				<span className="text-right font-semibold text-[10px] text-foreground leading-none">
					Total
				</span>
			</div>
			<div className={HOURS_LAYOUT}>
				<div
					className="grid h-4 items-center"
					style={{ gridTemplateColumns: HOUR_GRID_COLUMNS }}
				>
					{HOURS.map((hour) => (
						<HourTick key={`tick-${hour}`} hour={hour} />
					))}
				</div>
			</div>
		</div>
	);
}

function HourTick({ hour }: { hour: number }) {
	const { number, meridiem } = hourTickParts(hour);
	return (
		<div className="flex items-baseline justify-center gap-px leading-none">
			<span className="font-semibold text-[10px] text-foreground">
				{number}
			</span>
			<span className="text-[7px] text-muted-foreground">{meridiem}</span>
		</div>
	);
}

function SpeciesHourRowView({
	row,
	heatMax,
}: {
	row: SpeciesHourRow;
	heatMax: number;
}) {
	return (
		<div className={`${ROW_LAYOUT} border-line border-t`}>
			<div className={`h-8 ${LABEL_LAYOUT}`}>
				<div className="flex min-w-0 items-center gap-2">
					<div className={BIRD_BOX_CLASS}>
						<SpeciesImage
							imageUrl={row.imageUrl}
							alt={row.comName}
							glyphClassName="size-3.5"
							loading="lazy"
						/>
					</div>
					<Link
						to="/birds/$comName"
						params={{ comName: comNameToSlug(row.comName) }}
						className="min-w-0 truncate font-semibold text-sm no-underline hover:underline"
					>
						{row.comName}
					</Link>
					<div className="flex shrink-0 items-center gap-2">
						<SpeciesFlagPills
							isNew={row.isNew}
							isReturned={row.isReturned}
							isRare={row.isRare}
							isConsistent={row.isConsistent}
							regularNote={row.regularNote}
							away={row.away}
							vocal={row.vocal}
							firstHeard={row.firstHeard}
						/>
					</div>
				</div>

				<Count className="text-right">
					{row.totalDetections.toLocaleString()}
				</Count>
			</div>

			<div className={HOURS_LAYOUT}>
				<HeatRow row={row} heatMax={heatMax} />
			</div>
		</div>
	);
}

function HeatRow({ row, heatMax }: { row: SpeciesHourRow; heatMax: number }) {
	return (
		<div
			className="grid items-center"
			style={{ gridTemplateColumns: HOUR_GRID_COLUMNS }}
		>
			{HOURS.map((hour) => {
				const count = row.hourCounts[hour] ?? 0;
				return (
					<div
						key={`hour-${hour}`}
						role="img"
						aria-label={`${row.comName} — ${hourLabel(hour)}: ${count.toLocaleString()} detections`}
						className="mx-0.5 my-1 flex h-6 items-center justify-center overflow-hidden rounded-[3px] text-[10px] tabular-nums leading-none"
						style={{
							backgroundColor:
								count > 0 ? heatColor(count, heatMax) : EMPTY_CELL_COLOR,
							color: heatInk(count, heatMax),
						}}
					>
						{count > 0 ? compactCount(count) : null}
					</div>
				);
			})}
		</div>
	);
}

const NAME_WIDTHS = ["w-40", "w-28", "w-36", "w-32", "w-44", "w-24"];

export function SpeciesByHourCardSkeleton({
	summary,
	rows = 15,
	className = "",
}: {
	summary?: ReactNode;
	rows?: number;
	className?: string;
}) {
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label="Species by hour"
			className={`@container/card pb-1! ${className}`}
		>
			<div
				className={`${CARD_HEADER_CLASS} gap-3 py-2 max-[480px]:flex-wrap max-[480px]:gap-y-2`}
			>
				<div className="flex h-[calc(0.69rem*1.5)] min-w-0 items-center gap-3 max-[480px]:contents">
					<Kicker className="shrink-0">Activity</Kicker>
					{summary}
				</div>
			</div>
			<div aria-hidden="true" className="-mx-1 px-1">
				<HeaderRow />
				<div className="-mx-page [&>*]:px-page">
					{Array.from({ length: rows }, (_, index) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
							key={index}
							className={`${ROW_LAYOUT} border-line border-t`}
						>
							<div className={`h-8 ${LABEL_LAYOUT}`}>
								<div className="flex min-w-0 items-center gap-2">
									<div className={BIRD_BOX_CLASS}>
										<ShellBar className="size-5 rounded" />
									</div>
									<ShellText
										className="min-w-0 flex-1 font-semibold text-sm"
										barClassName={NAME_WIDTHS[index % NAME_WIDTHS.length]}
									/>
								</div>
								<ShellText
									className={cn(COUNT_CLASS, "w-10")}
									barClassName="right-0 left-auto w-8"
								/>
							</div>
							<div className={HOURS_LAYOUT}>
								<div
									className="grid items-center"
									style={{ gridTemplateColumns: HOUR_GRID_COLUMNS }}
								>
									{HOURS.map((hour) => (
										<ShellBar
											key={`hour-${hour}`}
											className="mx-0.5 my-1 h-6 rounded-[3px] opacity-60"
										/>
									))}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</Card>
	);
}

import { Link } from "@tanstack/react-router";
import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import type { ReactNode } from "react";
import { CARD_HEADER_CLASS } from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { SpeciesFlagPills } from "~/components/species-flag-pills.tsx";
import { SpeciesImage } from "~/components/species-image.tsx";
import { Card } from "~/components/ui/card.tsx";
import { COUNT_CLASS, Count } from "~/components/ui/count.tsx";
import { Hint } from "~/components/ui/hint.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { ShellBar, ShellFigure, ShellText } from "~/components/ui/shell.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import { heatColor, heatInk, heatMaximum } from "~/lib/heatmap.ts";
import type { VocalJump } from "~/lib/highlights-data.ts";
import { compactCount } from "~/lib/number-format.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { formatSunClock, type WindowSun } from "~/lib/sun-times.ts";
import { useTheme } from "~/lib/theme.ts";
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
	sun,
	emptyMessage,
	emptyAction,
	summary,
	className = "",
}: {
	rows: SpeciesHourRow[];
	sun?: WindowSun;
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
					className={`${CARD_HEADER_CLASS} gap-3 py-2 ${isEmpty ? "mb-page" : ""}`}
				>
					<HeaderLine
						summary={summary}
						sunTimes={sun?.available ? <HeaderSunTimes sun={sun} /> : null}
					/>
				</div>

				{isEmpty ? (
					<>
						<EmptyNote>{emptyMessage}</EmptyNote>
						{emptyAction ? <div className="mt-3">{emptyAction}</div> : null}
					</>
				) : (
					<div className="-mx-1 px-1">
						<SpeciesHourDataTable rows={rows} />
						{sun?.available ? <SunRow sun={sun} /> : null}
						<HeaderRow />

						<div className="-mx-page *:px-page">
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

function SpeciesHourDataTable({ rows }: { rows: SpeciesHourRow[] }) {
	return (
		<table className="sr-only">
			<caption>Species by hour</caption>
			<thead>
				<tr>
					<th scope="col">Species</th>
					{HOURS.map((hour) => (
						<th key={hour} scope="col">
							{hourLabel(hour)}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={row.comName}>
						<th scope="row">{row.comName}</th>
						{HOURS.map((hour) => (
							<td key={hour}>{(row.hourCounts[hour] ?? 0).toLocaleString()}</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
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
			<div aria-hidden="true" className={HOURS_LAYOUT}>
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

type DaylightSun = Extract<WindowSun, { available: true }>;

function HeaderLine({
	summary,
	sunTimes,
}: {
	summary?: ReactNode;
	sunTimes: ReactNode;
}) {
	return (
		<div className="flex h-6 min-w-0 flex-1 flex-wrap content-start items-center justify-between gap-x-3 gap-y-6 overflow-hidden">
			<div className="flex h-6 min-w-0 items-center gap-3">
				<Kicker as="h2" className="shrink-0">
					Activity
				</Kicker>
				{summary}
			</div>
			{sunTimes}
		</div>
	);
}

const SUN_ROW_CLASS = "@min-[56rem]/card:flex hidden items-center pt-2";

function SunRowFrame({ mark }: { mark: (hour: number) => ReactNode }) {
	return (
		<div className={SUN_ROW_CLASS}>
			<div className={`h-4 ${LABEL_LAYOUT}`} />
			<div className="flex-none">
				<div
					className="grid h-4 items-center"
					style={{ gridTemplateColumns: HOUR_GRID_COLUMNS }}
				>
					{HOURS.map((hour) => (
						<div key={`sun-${hour}`} className="flex justify-center">
							{mark(hour)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function SunRow({ sun }: { sun: DaylightSun }) {
	return <SunRowFrame mark={(hour) => <SunMark hour={hour} sun={sun} />} />;
}

function SunRowSkeleton() {
	return (
		<SunRowFrame mark={() => <ShellBar className="size-3 rounded-full" />} />
	);
}

function SunTimesFrame({
	qualifier,
	sunrise,
	sunset,
}: {
	qualifier?: ReactNode;
	sunrise: ReactNode;
	sunset: ReactNode;
}) {
	return (
		<p className="flex h-6 shrink-0 translate-y-[-1.5px] items-center gap-2 whitespace-nowrap text-[13px] text-muted-foreground">
			{qualifier}
			<Sunrise aria-hidden="true" className="size-3.5 shrink-0" />
			{sunrise}
			<span
				className="size-0.75 shrink-0 rounded-full bg-muted-foreground opacity-60"
				aria-hidden="true"
			/>
			<Sunset aria-hidden="true" className="size-3.5 shrink-0" />
			{sunset}
		</p>
	);
}

function HeaderSunTimes({ sun }: { sun: DaylightSun }) {
	return (
		<SunTimesFrame
			qualifier={sun.days > 1 ? <span>avg</span> : null}
			sunrise={<HeaderSunTime event="Sunrise" minutes={sun.sunriseMinutes} />}
			sunset={<HeaderSunTime event="Sunset" minutes={sun.sunsetMinutes} />}
		/>
	);
}

function HeaderSunTimesSkeleton() {
	return (
		<SunTimesFrame
			sunrise={
				<span>
					<ShellFigure placeholder="0:00" /> am
				</span>
			}
			sunset={
				<span>
					<ShellFigure placeholder="0:00" /> pm
				</span>
			}
		/>
	);
}

function HeaderSunTime({
	event,
	minutes,
}: {
	event: "Sunrise" | "Sunset";
	minutes: number;
}) {
	const [clock, meridiem] = formatSunClock(minutes).split(" ");
	return (
		<span>
			<span className="sr-only">{event} </span>
			<Count>{clock}</Count> {meridiem?.toLowerCase()}
		</span>
	);
}

function sunTimeLabel(
	event: "Sunrise" | "Sunset",
	minutes: number,
	days: number,
) {
	return `${event}${days > 1 ? ", avg" : ""} ${formatSunClock(minutes)}`;
}

function SunMark({ hour, sun }: { hour: number; sun: DaylightSun }) {
	if (hour === sun.sunriseHour || hour === sun.sunsetHour) {
		const isSunrise = hour === sun.sunriseHour;
		const Icon = isSunrise ? Sunrise : Sunset;
		const label = sunTimeLabel(
			isSunrise ? "Sunrise" : "Sunset",
			isSunrise ? sun.sunriseMinutes : sun.sunsetMinutes,
			sun.days,
		);
		return (
			<Hint content={label}>
				<button
					type="button"
					aria-label={label}
					className="flex size-4 cursor-default items-center justify-center"
				>
					<Icon aria-hidden="true" className="size-3 text-moss" />
				</button>
			</Hint>
		);
	}
	const isDay = hour > sun.sunriseHour && hour < sun.sunsetHour;
	const Icon = isDay ? Sun : Moon;
	return (
		<Icon
			aria-hidden="true"
			className={cn(
				"size-3",
				isDay ? "text-moss" : "text-muted-foreground opacity-60",
			)}
		/>
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
						preload={false}
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

			<div aria-hidden="true" className={HOURS_LAYOUT}>
				<HeatRow row={row} heatMax={heatMax} />
			</div>
		</div>
	);
}

function HeatRow({ row, heatMax }: { row: SpeciesHourRow; heatMax: number }) {
	const theme = useTheme();
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
						className="mx-0.5 my-1 flex h-6 items-center justify-center overflow-hidden rounded-[3px] text-[10px] tabular-nums leading-none"
						style={{
							backgroundColor:
								count > 0 ? heatColor(count, heatMax, theme) : EMPTY_CELL_COLOR,
							color: heatInk(count, heatMax, theme),
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
const SKELETON_ROWS = 15;

export function SpeciesByHourCardSkeleton({
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
			aria-label="Species by hour"
			className={`@container/card pb-1! ${className}`}
		>
			<div className={`${CARD_HEADER_CLASS} gap-3 py-2`}>
				<HeaderLine summary={summary} sunTimes={<HeaderSunTimesSkeleton />} />
			</div>
			<div aria-hidden="true" className="-mx-1 px-1">
				<SunRowSkeleton />
				<HeaderRow />
				<div className="-mx-page *:px-page">
					{Array.from({ length: SKELETON_ROWS }, (_, index) => (
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

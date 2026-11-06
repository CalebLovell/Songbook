import {
	Calendar,
	CalendarDays,
	CalendarRange,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock,
	Infinity as InfinityIcon,
} from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import {
	TIMELINE_PERIOD_LABELS,
	TIMELINE_PERIODS,
	type TimelinePeriod,
} from "~/lib/timeline-periods.ts";
import {
	anchorForDay,
	currentAnchor,
	isValidAnchor,
	shortAnchorLabel,
	stepAnchor,
	type TimelineAnchor,
	type TimelineWindow,
} from "~/lib/timeline-window.ts";
import { useClientValue } from "~/lib/use-client-value.ts";

const PERIOD_ICONS: Record<
	TimelinePeriod,
	React.ComponentType<{ className?: string }>
> = {
	day: Clock,
	week: CalendarDays,
	month: CalendarRange,
	year: Calendar,
	all: InfinityIcon,
};

const PICKER_TYPES: Record<Exclude<TimelinePeriod, "all">, string> = {
	day: "date",
	week: "week",
	month: "month",
	year: "number",
};

const PICKER_LABELS: Record<Exclude<TimelinePeriod, "all">, string> = {
	day: "Day",
	week: "Week",
	month: "Month",
	year: "Year",
};

export function PeriodToolbar({
	period,
	anchor,
	window,
	lastActiveDay,
	stationRange,
	viewSwitch,
	onChange,
}: {
	period: TimelinePeriod;
	anchor: TimelineAnchor;
	window: TimelineWindow | null;
	lastActiveDay: string | null;
	stationRange: { first: string; last: string } | null;
	viewSwitch?: React.ReactNode;
	onChange: (next: { period?: TimelinePeriod; date?: string }) => void;
}) {
	const pickPeriod = (next: TimelinePeriod) => {
		const carried = lastActiveDay ?? window?.start;
		onChange({
			period: next,
			date:
				next === "all" || !carried ? undefined : anchorForDay(next, carried),
		});
	};

	return (
		<div className="flex items-center justify-between gap-page max-[480px]:flex-wrap">
			<PeriodSelect period={period} onPick={pickPeriod} />
			<div className="hidden min-[800px]:block">
				<ToggleGroup
					type="single"
					variant="outline"
					value={period}
					onValueChange={(value) => {
						if (value) pickPeriod(value as TimelinePeriod);
					}}
				>
					{TIMELINE_PERIODS.map((value) => {
						const Icon = PERIOD_ICONS[value];
						return (
							<ToggleGroupItem key={value} value={value}>
								<Icon className="size-4" />
								{TIMELINE_PERIOD_LABELS[value]}
							</ToggleGroupItem>
						);
					})}
				</ToggleGroup>
			</div>

			<div className="flex min-w-0 flex-1 items-center justify-end gap-page max-[480px]:contents">
				{viewSwitch}
				{period !== "all" ? (
					<WindowStepper
						period={period}
						anchor={anchor}
						stationRange={stationRange}
						onPick={(date) => onChange({ date })}
					/>
				) : null}
			</div>
		</div>
	);
}

function PeriodSelect({
	period,
	onPick,
}: {
	period: TimelinePeriod;
	onPick: (next: TimelinePeriod) => void;
}) {
	const Icon = PERIOD_ICONS[period];
	return (
		<div className="relative shrink-0 min-[800px]:hidden">
			<Icon
				className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 max-[400px]:hidden"
				aria-hidden="true"
			/>
			<select
				aria-label="Period"
				value={period}
				onChange={(event) => onPick(event.target.value as TimelinePeriod)}
				className="h-8.5 pointer-coarse:h-9 cursor-pointer appearance-none rounded-md border border-input bg-card pr-7 pl-8 font-medium pointer-coarse:text-base text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-focus-ring focus-visible:outline-none max-[400px]:pl-2.5"
			>
				{TIMELINE_PERIODS.map((value) => (
					<option key={value} value={value}>
						{TIMELINE_PERIOD_LABELS[value]}
					</option>
				))}
			</select>
			<ChevronDown
				className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
				aria-hidden="true"
			/>
		</div>
	);
}

function WindowStepper({
	period,
	anchor,
	stationRange,
	onPick,
}: {
	period: Exclude<TimelinePeriod, "all">;
	anchor: TimelineAnchor;
	stationRange: { first: string; last: string } | null;
	onPick: (anchor: TimelineAnchor) => void;
}) {
	const label = PICKER_LABELS[period];
	const nativePicker = useNativePicker(PICKER_TYPES[period]);
	const valid = isValidAnchor(period, anchor);
	const prevTarget = valid ? stepAnchor(period, anchor, -1) : null;
	const nextTarget = valid ? stepAnchor(period, anchor, 1) : null;

	const overlay = "absolute inset-0 size-full cursor-pointer opacity-0";

	return (
		<div className="flex h-8.5 pointer-coarse:h-9 min-w-0 max-w-64 flex-1 overflow-hidden rounded-md border border-input bg-card focus-within:border-focus-ring max-[480px]:max-w-none max-[480px]:basis-full">
			<JoinedStep
				direction="prev"
				label={`Previous ${label.toLowerCase()}`}
				target={prevTarget}
				onPick={onPick}
			/>
			<div className="relative flex min-w-0 flex-1 items-center justify-center px-1 pointer-coarse:text-base text-sm">
				<Calendar
					className="mr-2 size-4 shrink-0 text-muted-foreground max-[400px]:hidden"
					aria-hidden="true"
				/>
				<span className="truncate max-[400px]:hidden">
					{shortAnchorLabel(period, anchor)}
				</span>
				<span className="truncate min-[400px]:hidden">
					{shortAnchorLabel(period, anchor, { compact: true })}
				</span>
				{period === "year" ? (
					<select
						aria-label={label}
						className={overlay}
						value={anchor}
						onChange={(event) => onPick(event.target.value)}
					>
						{pickableYears(anchor, stationRange).map((year) => (
							<option key={year} value={year}>
								{year}
							</option>
						))}
					</select>
				) : nativePicker ? (
					<input
						aria-label={label}
						className={`${overlay} min-w-0 appearance-none text-base`}
						type={PICKER_TYPES[period]}
						value={anchor}
						onClick={(event) => {
							try {
								event.currentTarget.showPicker?.();
							} catch {}
						}}
						onChange={(event) => {
							if (isValidAnchor(period, event.target.value)) {
								onPick(event.target.value);
							}
						}}
					/>
				) : null}
			</div>
			<JoinedStep
				direction="next"
				label={`Next ${label.toLowerCase()}`}
				target={nextTarget}
				onPick={onPick}
			/>
		</div>
	);
}

function browserSupportsInputType(type: string): boolean {
	const probe = document.createElement("input");
	probe.setAttribute("type", type);
	return probe.type === type;
}

function useNativePicker(type: string): boolean {
	return useClientValue(() => browserSupportsInputType(type), true);
}

function pickableYears(
	anchor: TimelineAnchor,
	stationRange: { first: string; last: string } | null,
): string[] {
	const years = [Number(currentAnchor("year"))];
	if (isValidAnchor("year", anchor)) years.push(Number(anchor));
	if (stationRange) {
		years.push(Number(stationRange.first.slice(0, 4)));
		years.push(Number(stationRange.last.slice(0, 4)));
	}
	const from = Math.min(...years) - 1;
	const to = Math.max(...years) + 1;
	return Array.from({ length: to - from + 1 }, (_, i) => String(to - i));
}

function JoinedStep({
	direction,
	label,
	target,
	onPick,
}: {
	direction: "prev" | "next";
	label: string;
	target: TimelineAnchor | null;
	onPick: (anchor: TimelineAnchor) => void;
}) {
	const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={target === null}
			onClick={() => target && onPick(target)}
			className={`flex w-8.5 shrink-0 items-center justify-center border-input hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 ${direction === "prev" ? "border-r" : "border-l"}`}
		>
			<Icon className="size-4" aria-hidden="true" />
		</button>
	);
}

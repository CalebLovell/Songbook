import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { ArrowRight, CalendarRange, LayoutDashboard, List } from "lucide-react";
import { z } from "zod";
import { Deferred, SHELL_DELAY_MS } from "~/components/deferred.tsx";
import {
	DetectionsByHourCard,
	DetectionsByHourCardSkeleton,
} from "~/components/detections-by-hour-card.tsx";
import { HighlightsCard } from "~/components/highlights-card.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { ShareButton, useShare } from "~/components/share-button.tsx";
import { InMenuBar } from "~/components/sidebar/mobile-nav.tsx";
import {
	SpeciesByHourCard,
	SpeciesByHourCardSkeleton,
} from "~/components/species-by-hour-card.tsx";
import {
	SpeciesGrid,
	type SpeciesGridItem,
	SpeciesGridSkeleton,
} from "~/components/species-grid.tsx";
import { StatusPage } from "~/components/status-page.tsx";
import { PeriodToolbar } from "~/components/timeline/period-toolbar.tsx";
import { ButtonLink } from "~/components/ui/button-link.tsx";
import { Count } from "~/components/ui/count.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { ShellFigure } from "~/components/ui/shell.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { TooltipProvider } from "~/components/ui/tooltip.tsx";
import { getDayShareCard } from "~/lib/day-share.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import type { HighlightThresholds } from "~/lib/highlight-thresholds.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { formatShareCard } from "~/lib/share-card.ts";
import type { HourActivity } from "~/lib/stats-data.ts";
import type { TimelineData, TimelineRow } from "~/lib/timeline.ts";
import { getTimelinePage, type TimelinePageData } from "~/lib/timeline-page.ts";
import {
	TIMELINE_PERIOD_LABELS,
	TIMELINE_PERIODS,
	type TimelinePeriod,
} from "~/lib/timeline-periods.ts";
import { formatTimelineShareCard } from "~/lib/timeline-share.ts";
import {
	currentAnchor,
	isValidAnchor,
	spelledDate,
	windowFor,
} from "~/lib/timeline-window.ts";
import { useSettled } from "~/lib/use-settled.ts";

const DEFAULT_PERIOD: TimelinePeriod = "day";

const TIMELINE_VIEWS = ["hours", "grid"] as const;
type TimelineView = (typeof TIMELINE_VIEWS)[number];
const DEFAULT_VIEW: TimelineView = "hours";

const timelineSearchSchema = z.object({
	period: z
		.enum(TIMELINE_PERIODS)
		.default(DEFAULT_PERIOD)
		.catch(DEFAULT_PERIOD),
	view: z.enum(TIMELINE_VIEWS).default(DEFAULT_VIEW).catch(DEFAULT_VIEW),
	date: z.coerce.string().optional().catch(undefined),
});

function resolveAnchor(period: TimelinePeriod, date: string | undefined) {
	if (!date) return currentAnchor(period);
	if (isValidAnchor(period, date)) return date;
	return period === "day" ? date : currentAnchor(period);
}

export const Route = createFileRoute("/timeline")({
	head: () => ({ meta: [{ title: pageTitle("Timeline") }] }),
	validateSearch: timelineSearchSchema,
	search: {
		middlewares: [
			stripSearchParams({ period: DEFAULT_PERIOD, view: DEFAULT_VIEW }),
		],
	},
	loaderDeps: ({ search }) => ({
		period: search.period,
		anchor: resolveAnchor(search.period, search.date),
	}),
	loader: ({ deps }) => ({ page: getTimelinePage({ data: deps }) }),
	component: Timeline,
});

function Timeline() {
	const { page } = Route.useLoaderData();
	const settled = useSettled(page);
	const search = Route.useSearch();
	const { period, view } = search;
	const anchor = resolveAnchor(period, search.date);
	const navigate = Route.useNavigate();

	const show = (next: {
		period?: TimelinePeriod;
		date?: string;
		view?: TimelineView;
	}) =>
		navigate({
			search: (prev) => ({ ...prev, ...next }),
			replace: true,
			resetScroll: false,
		});

	if (settled?.current && settled.value.body.kind === "not-a-date") {
		return <NotADate date={anchor} />;
	}

	return (
		<TooltipProvider>
			<PageWrap className="space-y-page">
				<TimelineHeader
					data={settled?.current ? settled.value : null}
					staleData={settled?.value ?? null}
					period={period}
					anchor={anchor}
					viewSwitch={
						<ViewToggle
							view={view}
							onViewChange={(next) => show({ view: next })}
						/>
					}
					onChange={show}
				/>

				<Deferred
					promise={page}
					shellAfterMs={SHELL_DELAY_MS}
					shell={<TimelineCardsShell period={period} view={view} />}
				>
					{(data) =>
						data.body.kind === "not-a-date" ? null : (
							<TimelineCards
								rows={data.body.rows}
								highlights={data.body.highlights}
								thresholds={data.body.thresholds}
								period={data.period}
								jumpTo={jumpTarget(data)}
								windowLabel={data.window?.label ?? null}
								stationEmpty={!data.hasAnyDetections}
								view={view}
							/>
						)
					}
				</Deferred>
			</PageWrap>
		</TooltipProvider>
	);
}

function TimelineCardsShell({
	period,
	view,
}: {
	period: TimelinePeriod;
	view: TimelineView;
}) {
	const summary = <WindowSummary rows={null} />;
	return (
		<div className="min-[1800px]:flex min-[1800px]:items-start min-[1800px]:gap-4">
			{view === "hours" ? (
				<SpeciesByHourCardSkeleton
					summary={summary}
					className={BODY_CARD_WIDTH}
				/>
			) : (
				<SpeciesGridSkeleton summary={summary} className={BODY_CARD_WIDTH} />
			)}
			<div className="mt-page grid min-w-0 gap-page md:max-[1799px]:grid-cols-2 min-[1800px]:mt-0 min-[1800px]:flex-1">
				<HighlightsCard
					highlights={null}
					period={period}
					emptyMessage=""
					className="self-start"
				/>
				<DetectionsByHourCardSkeleton
					info={HOUR_CARD_INFO}
					className={HOUR_CARD_SIZE}
				/>
			</div>
		</div>
	);
}

const HOUR_CARD_INFO = (
	<p>
		This chart shows all the birds recorded each hour for the selected time
		period. The peaks show what time of day the station is most active, and the
		valleys show when it is most quiet.
	</p>
);

const PERIOD_NOUNS: Record<Exclude<TimelinePeriod, "all">, string> = {
	day: "day",
	week: "week",
	month: "month",
	year: "year",
};

type JumpTarget = {
	anchor: string;
	direction: "last" | "next";
	noun: string;
	label: string;
};

function jumpTarget(data: TimelinePageData): JumpTarget | null {
	const { period } = data;
	if (period === "all" || data.body.kind !== "rows") return null;
	if (data.body.rows.length > 0) return null;
	const [anchor, direction] = data.prevAnchor
		? [data.prevAnchor, "last" as const]
		: data.nextAnchor
			? [data.nextAnchor, "next" as const]
			: [null, null];
	if (!anchor || !direction) return null;
	return {
		anchor,
		direction,
		noun: PERIOD_NOUNS[period],
		label:
			period === "day" ? spelledDate(anchor) : windowFor(period, anchor).label,
	};
}

function TimelineHeader({
	data,
	staleData,
	period,
	anchor,
	viewSwitch,
	onChange,
}: {
	data: TimelinePageData | null;
	staleData: TimelinePageData | null;
	period: TimelinePeriod;
	anchor: string;
	viewSwitch: React.ReactNode;
	onChange: (next: { period?: TimelinePeriod; date?: string }) => void;
}) {
	const rows = data?.body.kind === "rows" ? data.body.rows : [];
	const highlights = data?.body.kind === "rows" ? data.body.highlights : [];
	const toolbarData = data ?? staleData;

	const loadShare = async () =>
		period === "day"
			? formatShareCard({
					...(await getDayShareCard({ data: anchor })),
					highlights,
					heading: headerLines(period, anchor),
				})
			: formatTimelineShareCard({
					period,
					heading: headerLines(period, anchor),
					rows,
					highlights,
				});
	const share = useShare({
		subject: `${period}:${anchor}`,
		hasData: data !== null,
		load: loadShare,
	});
	const canShare = toolbarData?.hasAnyDetections ?? false;

	return (
		<>
			{canShare && (
				<InMenuBar>
					<ShareButton state={share} shape="plain" />
				</InMenuBar>
			)}
			<PageHeaderCard
				icon={CalendarRange}
				title={headerTitle(period, anchor)}
				description={PAGE_HEADERS.timeline.description}
				action={
					canShare ? (
						<ShareButton state={share} className="max-xl:hidden" />
					) : undefined
				}
				afterHeader={
					<PeriodToolbar
						period={period}
						anchor={anchor}
						window={data ? data.window : safeWindow(period, anchor)}
						lastActiveDay={data?.lastActiveDay ?? null}
						stationRange={toolbarData?.stationRange ?? null}
						viewSwitch={viewSwitch}
						onChange={onChange}
					/>
				}
			/>
		</>
	);
}

function headerTitle(period: TimelinePeriod, anchor: string): string {
	return headerLines(period, anchor).join(" — ");
}

function headerLines(period: TimelinePeriod, anchor: string): string[] {
	const scope = TIMELINE_PERIOD_LABELS[period];
	if (period === "all") return [scope];
	if (period === "day") {
		return [
			scope,
			isValidAnchor("day", anchor)
				? spelledDate(anchor, { short: true })
				: anchor,
		];
	}
	return [scope, safeWindow(period, anchor)?.label ?? anchor];
}

function safeWindow(period: TimelinePeriod, anchor: string) {
	return isValidAnchor(period, anchor) ? windowFor(period, anchor) : null;
}

function WindowSummary({ rows }: { rows: TimelineRow[] | null }) {
	const detections = rows?.reduce((sum, row) => sum + row.totalDetections, 0);

	return (
		<div className="flex min-w-0 items-center gap-2.5 max-[480px]:order-last max-[480px]:basis-full">
			<span
				className="h-4 w-px shrink-0 bg-line max-[480px]:hidden"
				aria-hidden="true"
			/>
			<div className="flex -translate-y-[1.5px] items-center gap-2 truncate text-[13px] text-muted-foreground">
				<span className="whitespace-nowrap">
					{detections === undefined ? (
						<ShellFigure />
					) : (
						<Count>{detections.toLocaleString()}</Count>
					)}{" "}
					detections
				</span>
				<span
					className="size-[3px] shrink-0 rounded-full bg-muted-foreground opacity-60"
					aria-hidden="true"
				/>
				<span className="whitespace-nowrap">
					{rows ? (
						<Count>{rows.length.toLocaleString()}</Count>
					) : (
						<ShellFigure />
					)}{" "}
					species
				</span>
			</div>
		</div>
	);
}

function TimelineCards({
	rows,
	highlights,
	thresholds,
	period,
	jumpTo,
	windowLabel,
	stationEmpty,
	view,
}: {
	rows: TimelineRow[];
	highlights: TimelineData["highlights"];
	thresholds: HighlightThresholds;
	period: TimelinePeriod;
	jumpTo: JumpTarget | null;
	windowLabel: string | null;
	stationEmpty: boolean;
	view: TimelineView;
}) {
	const emptyMessage = stationEmpty
		? EMPTY.station.detections
		: EMPTY.window.timelineWindow(windowLabel);
	const emptyAction = jumpTo ? (
		<>
			<p className="text-muted-foreground text-sm">
				{jumpTo.direction === "last" ? "Last" : "Next"} {jumpTo.noun} with
				detections: {jumpTo.label}.
			</p>
			<ButtonLink
				to="/timeline"
				search={(prev) => ({ ...prev, date: jumpTo.anchor })}
				size="default"
				icon={ArrowRight}
				iconPosition="end"
				className="mt-page"
			>
				View {jumpTo.direction === "last" ? "last" : "next"} detections
			</ButtonLink>
		</>
	) : undefined;

	const gridItems: SpeciesGridItem[] = rows.map((row) => ({
		comName: row.comName,
		sciName: row.sciName,
		imageUrl: row.imageUrl,
		count: row.totalDetections,
		isNew: row.isNew,
		firstHeard: row.firstHeard,
		isRare: row.isRare,
		isConsistent: row.isConsistent,
		regularNote: row.regularNote,
		isReturned: row.isReturned,
		away: row.away,
		vocal: row.vocal,
		hourCounts: row.hourCounts,
	}));

	const summary = <WindowSummary rows={rows} />;

	const hourActivity: HourActivity[] = Array.from(
		{ length: 24 },
		(_, hour) => ({
			hour,
			count: rows.reduce((sum, row) => sum + (row.hourCounts[hour] ?? 0), 0),
		}),
	);

	const body =
		view === "hours" ? (
			<SpeciesByHourCard
				rows={rows}
				emptyMessage={emptyMessage}
				emptyAction={emptyAction}
				summary={summary}
				className={BODY_CARD_WIDTH}
			/>
		) : (
			<SpeciesGrid
				species={gridItems}
				emptyMessage={emptyMessage}
				emptyAction={emptyAction}
				summary={summary}
				className={BODY_CARD_WIDTH}
			/>
		);

	return (
		<div className="min-[1800px]:flex min-[1800px]:items-start min-[1800px]:gap-4">
			{body}
			<div className="mt-page grid min-w-0 gap-page md:max-[1799px]:grid-cols-2 min-[1800px]:mt-0 min-[1800px]:flex-1">
				<HighlightsCard
					highlights={highlights}
					thresholds={thresholds}
					period={period}
					emptyMessage={emptyMessage}
					className="self-start"
				/>
				<DetectionsByHourCard
					activity={hourActivity}
					emptyMessage={emptyMessage}
					info={HOUR_CARD_INFO}
					className={
						hourActivity.some((point) => point.count > 0)
							? HOUR_CARD_SIZE
							: "self-start"
					}
				/>
			</div>
		</div>
	);
}

const BODY_CARD_WIDTH = "min-w-0 min-[1800px]:w-[72rem] min-[1800px]:flex-none";

const HOUR_CARD_SIZE = "self-start";

const VIEW_META: Record<
	TimelineView,
	{
		label: string;
		icon: React.ComponentType<{ className?: string }>;
	}
> = {
	hours: {
		label: "List",
		icon: List,
	},
	grid: {
		label: "Grid",
		icon: LayoutDashboard,
	},
};

function ViewToggle({
	view,
	onViewChange,
}: {
	view: TimelineView;
	onViewChange: (next: TimelineView) => void;
}) {
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			aria-label="View"
			className="shrink-0"
			value={view}
			onValueChange={(value) => {
				if (value) onViewChange(value as TimelineView);
			}}
		>
			{TIMELINE_VIEWS.map((value) => {
				const { label, icon: Icon } = VIEW_META[value];
				return (
					<ToggleGroupItem
						key={value}
						value={value}
						aria-label={label}
						title={label}
						className="pointer-coarse:w-9 w-8.5 px-0"
					>
						<Icon className="size-4" aria-hidden="true" />
					</ToggleGroupItem>
				);
			})}
		</ToggleGroup>
	);
}

function NotADate({ date }: { date: string }) {
	return (
		<StatusPage
			icon={CalendarRange}
			section={PAGE_HEADERS.timeline.missingSection}
			sectionDescription={PAGE_HEADERS.timeline.missingDescription}
			tone="missing"
			title="That isn't a date"
		>
			“{date}” isn’t a valid date. Dates look like 2025-04-19.
		</StatusPage>
	);
}

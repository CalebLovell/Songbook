import { useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	notFound,
	stripSearchParams,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Feather } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
	BestRecordingCard,
	BestRecordingCardSkeleton,
} from "~/components/best-recording-card.tsx";
import { CardHeader } from "~/components/card-header.tsx";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { Deferred } from "~/components/deferred.tsx";
import {
	DetectionsByHourCard,
	DetectionsByHourCardSkeleton,
} from "~/components/detections-by-hour-card.tsx";
import {
	DetectionsByMonthCard,
	DetectionsByMonthCardSkeleton,
} from "~/components/detections-by-month-card.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { IndexDot } from "~/components/index-dot.tsx";
import { PageStatus } from "~/components/page-status.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesActions } from "~/components/species-actions.tsx";
import { SpeciesImage } from "~/components/species-image.tsx";
import { Button } from "~/components/ui/button.tsx";
import { ButtonLink } from "~/components/ui/button-link.tsx";
import { Card } from "~/components/ui/card.tsx";
import { Count } from "~/components/ui/count.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import {
	PAGE_RANGE_CLASS,
	PAGE_RANGE_NARROW_HIDDEN,
	PAGE_ROW_CLASS,
	PageRange,
	PageStepper,
} from "~/components/ui/page-stepper.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { RowWell } from "~/components/ui/row-well.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "~/components/ui/tooltip.tsx";
import { YearSelector } from "~/components/year-selector.tsx";
import { formatConfidence } from "~/lib/confidence.ts";
import { formatDate, formatDateTime, formatTime } from "~/lib/date-format.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { heatColor, heatColorAt } from "~/lib/heatmap.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import {
	previewImageMeta,
	previewTextMeta,
	speciesPreviewImage,
} from "~/lib/link-preview.ts";
import { pageTitle } from "~/lib/page-title.ts";
import {
	getBirdIdentity,
	getSpeciesDetail,
	getSpeciesVisits,
	type SpeciesDetail,
	VISITS_PAGE_SIZE,
	type VisitPage,
	visitPageCount,
} from "~/lib/species-detail.ts";
import { speciesLinkFor } from "~/lib/species-link.ts";
import { comNameForSlug, comNameToSlug } from "~/lib/species-slug.ts";
import { stationOrigin } from "~/lib/station-origin.ts";
import { stationToday } from "~/lib/station-time.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";
import type { TrendPoint } from "~/lib/trend.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useCanListen } from "~/lib/use-can-listen.ts";

const CURRENT_YEAR = Number(stationToday().slice(0, 4));
const MIN_YEAR = 2000;
const DEFAULT_YEAR = CURRENT_YEAR;

const HOUR_CARD_INFO = (
	<p>
		This chart shows every detection of this bird by hour of day, across all the
		time the station has been listening. The peaks show when it is heard most
		often, and the valleys show when it is most quiet.
	</p>
);

const speciesDetailSearchSchema = z.object({
	year: z.coerce
		.number()
		.int()
		.min(MIN_YEAR)
		.max(CURRENT_YEAR)
		.default(DEFAULT_YEAR)
		.catch(DEFAULT_YEAR),
	visits: z.coerce.number().int().min(1).default(1).catch(1),
});

export const Route = createFileRoute("/birds/$comName")({
	validateSearch: speciesDetailSearchSchema,
	search: {
		middlewares: [stripSearchParams({ year: DEFAULT_YEAR, visits: 1 })],
	},
	loaderDeps: ({ search }) => ({ year: search.year }),
	loader: async ({ params, deps, location }) => {
		const result = getSpeciesDetail({
			data: {
				comNameSlug: params.comName,
				year: deps.year,
				visitsPage: (location.search as { visits?: number }).visits,
			},
		});
		const seenName = comNameForSlug(params.comName);
		const bird = seenName
			? { comName: seenName, sciName: null }
			: await getBirdIdentity({ data: params.comName });
		if (!bird) {
			result.catch(() => {});
			throw notFound();
		}
		comNameToSlug(bird.comName);
		return { result, comName: bird.comName, sciName: bird.sciName };
	},
	head: ({ loaderData }) => speciesHead(loaderData),
	pendingMs: 1000,
	pendingComponent: BirdPendingShell,
	notFoundComponent: SpeciesNotFound,
	component: BirdPage,
});

function speciesHead(bird?: { comName: string; sciName: string | null }) {
	if (!bird) return { meta: [{ title: pageTitle("No such bird") }] };
	const { comName, sciName } = bird;
	const description = sciName
		? `A Songbook station's record of the ${comName} (${sciName}).`
		: `A Songbook station's record of the ${comName}.`;
	const image = sciName
		? speciesPreviewImage(stationOrigin(), comName, sciName)
		: null;
	return {
		meta: [
			{ title: pageTitle(comName) },
			...previewTextMeta(comName, description),
			...(image ? previewImageMeta(image) : []),
		],
	};
}

type HeatMapWeek = {
	days: { date: Date; point: TrendPoint | null }[];
	monthLabel: string | null;
};

function dateForBucket(bucket: string): Date {
	return new Date(`${bucket.slice(0, 10)}T00:00:00`);
}

function bucketForDate(date: Date): string {
	const pad = (value: number) => value.toString().padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildHeatMap(history: TrendPoint[]): {
	weeks: HeatMapWeek[];
	maximum: number;
} {
	if (history.length === 0) return { weeks: [], maximum: 0 };

	const points = new Map(
		history.map((point) => [point.bucket.slice(0, 10), point]),
	);
	const firstDate = dateForBucket(history[0].bucket);
	const lastDate = dateForBucket(history[history.length - 1].bucket);
	const start = new Date(firstDate);
	start.setDate(start.getDate() - start.getDay());
	const end = lastDate;
	const weeks: HeatMapWeek[] = [];
	const seenMonths = new Set<string>();
	const maximum = Math.max(...history.map((point) => point.count), 0);

	for (
		const weekStart = new Date(start);
		weekStart <= end;
		weekStart.setDate(weekStart.getDate() + 7)
	) {
		const days: { date: Date; point: TrendPoint | null }[] = [];
		let monthLabel: string | null = null;
		for (let day = 0; day < 7; day += 1) {
			const date = new Date(weekStart);
			date.setDate(date.getDate() + day);
			if (date > end) break;
			const key = bucketForDate(date);
			days.push({ date, point: points.get(key) ?? null });
			const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
			if (date.getDate() <= 7 && !seenMonths.has(monthKey)) {
				monthLabel = date.toLocaleDateString([], { month: "short" });
				seenMonths.add(monthKey);
			}
		}
		weeks.push({ days, monthLabel });
	}

	return { weeks, maximum };
}

function BirdPage() {
	const { result } = Route.useLoaderData();
	const { year } = Route.useSearch();

	return (
		<Deferred
			key={year}
			promise={result}
			shell={<SpeciesDetailShell year={year} />}
		>
			{(loaded) => <BirdResult result={loaded} />}
		</Deferred>
	);
}

function BirdPendingShell() {
	return <SpeciesDetailShell year={Route.useSearch().year} />;
}

function BirdResult({
	result,
}: {
	result: Awaited<ReturnType<typeof getSpeciesDetail>>;
}) {
	if (result.status === "undetected") {
		return (
			<UndetectedSpecies comName={result.comName} sciName={result.sciName} />
		);
	}
	if (result.status !== "detected") return <SpeciesNotFound />;

	return <SpeciesDetailView detail={result.detail} />;
}

function SpeciesDetailShell({ year }: { year: number }) {
	return (
		<PageWrap className="@container/bird pt-0">
			<Card
				as="section"
				aria-busy="true"
				aria-label="Bird profile"
				className={PROFILE_CARD_CLASS}
			>
				<div className={PROFILE_PORTRAIT_CLASS}>
					<ShellBar className="size-full rounded-md" />
				</div>
				<div aria-hidden="true" className={PROFILE_TEXT_CLASS}>
					<div className="min-w-0">
						<ShellText
							className="font-bold text-2xl sm:text-3xl"
							barClassName="w-64 max-w-full"
						/>
						<ShellText className="text-xs" barClassName="w-32" />
					</div>
					<ShellText className="text-sm" barClassName="w-80 max-w-full" />
					<div className="relative z-10 flex flex-wrap items-center gap-2">
						<ShellSized className="rounded-md">
							<Button variant="outline" size="sm" icon={ExternalLink}>
								eBird
							</Button>
						</ShellSized>
					</div>
				</div>
			</Card>

			<div className={COLUMNS_CLASS}>
				<Card
					as="section"
					aria-busy="true"
					aria-label="Detection history"
					className="overflow-hidden"
				>
					<CardHeader title="Detection history" className="flex-wrap">
						<div className="-my-1">
							<ShellSized className="rounded-md">
								<YearSelector
									year={year}
									years={[year - 1, year]}
									onChange={() => {}}
								/>
							</ShellSized>
						</div>
					</CardHeader>
					<div aria-hidden="true" className="mt-page flex gap-2">
						<WeekdayLabels />
						<div className="min-w-0 flex-1 overflow-hidden pb-1">
							<div className="w-max">
								<div className="mb-1 h-3" />
								<div className="flex w-max gap-1">
									{Array.from({ length: weeksInYear(year) }, (_, week) => (
										<div
											// biome-ignore lint/suspicious/noArrayIndexKey: one column per week
											key={week}
											className="flex shrink-0 flex-col gap-1"
										>
											{Array.from({ length: 7 }, (_, day) => (
												<span
													// biome-ignore lint/suspicious/noArrayIndexKey: one square per day
													key={day}
													className="size-3 animate-pulse rounded-[3px] bg-muted"
												/>
											))}
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
					<div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 max-[400px]:mt-2">
						<ShellText
							className="w-56 text-xs"
							barClassName="w-full"
							strut={<Count>&nbsp;</Count>}
						/>
						<HeatLegend />
					</div>
				</Card>

				<BestRecordingCardSkeleton />

				<div className="grid min-w-0 @min-[80rem]/bird:grid-rows-2 gap-page">
					<DetectionsByHourCardSkeleton
						info={HOUR_CARD_INFO}
						className="@min-[80rem]/bird:min-h-0"
					/>
					<DetectionsByMonthCardSkeleton className="@min-[80rem]/bird:min-h-0" />
				</div>

				<VisitLogSkeleton />
			</div>
		</PageWrap>
	);
}

function weeksInYear(year: number): number {
	const [todayYear, todayMonth, todayDay] = stationToday()
		.split("-")
		.map(Number);
	const end =
		year === CURRENT_YEAR
			? new Date(todayYear, todayMonth - 1, todayDay)
			: new Date(year, 11, 31);
	const start =
		year === CURRENT_YEAR
			? new Date(end.getFullYear(), end.getMonth(), end.getDate() - 364)
			: new Date(year, 0, 1);
	const sunday = new Date(start);
	sunday.setDate(sunday.getDate() - sunday.getDay());
	const span = Math.round((end.getTime() - sunday.getTime()) / 86_400_000);
	return Math.floor(span / 7) + 1;
}

function VisitLogSkeleton() {
	const canListen = useCanListen();
	return (
		<section
			aria-busy="true"
			aria-label="Visit log"
			className={VISIT_LOG_CLASS}
		>
			<Card className={VISIT_LOG_CARD_CLASS}>
				<div className={VISIT_LOG_HEADER_CLASS}>
					<Kicker as="h2">Visit log</Kicker>
				</div>
				<RowWell as="ul" aria-hidden="true" className={VISIT_LIST_CLASS}>
					{Array.from({ length: VISITS_PAGE_SIZE }, (_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
						<li key={index} className={VISIT_ROW_CLASS}>
							<ShellSized className="rounded-full">
								<IndexDot index={VISITS_PAGE_SIZE} widest={VISITS_PAGE_SIZE} />
							</ShellSized>
							<div className="min-w-0 flex-1 text-sm">
								<ShellText
									className="font-medium"
									barClassName="w-48 max-w-full"
								/>
								<ShellText className="text-xs" barClassName="w-20" />
							</div>
							<ShellSized className="rounded-full">
								<ConfidencePill confidence={0.9} className="shrink-0" />
							</ShellSized>
							{canListen ? (
								<ShellSized className="rounded-md">
									<RecordingButton audioUrl={null} {...VISIT_ROW_BUTTON} />
								</ShellSized>
							) : null}
						</li>
					))}
				</RowWell>
				<div aria-hidden="true" className={VISIT_LOG_FOOTER_CLASS}>
					<div className={PAGE_ROW_CLASS}>
						<div className={`${PAGE_RANGE_CLASS} ${PAGE_RANGE_NARROW_HIDDEN}`}>
							<ShellText className="w-36" barClassName="w-full" />
						</div>
						<span className="ml-auto">
							<ShellSized className="rounded-md">
								<PageStepper
									variant="ghost"
									label="Visit log pages"
									page={1}
									pageCount={100}
									onPageChange={() => {}}
								/>
							</ShellSized>
						</span>
					</div>
				</div>
			</Card>
		</section>
	);
}

function UndetectedSpecies({
	comName,
	sciName,
}: {
	comName: string;
	sciName: string;
}) {
	return (
		<PageWrap className="pt-0">
			<Card
				as="section"
				aria-label="Bird profile"
				className="mt-page grid overflow-hidden p-0 sm:grid-cols-[12rem_minmax(0,1fr)]"
			>
				<div className="flex h-36 items-center justify-center overflow-hidden p-4 pb-0 sm:h-44 sm:pb-4">
					<SpeciesImage
						imageUrl={illustrationUrlFor(sciName)}
						alt={comName}
						glyphClassName="size-16"
						cropToPainting
					/>
				</div>

				<div className="flex min-w-0 flex-col justify-center gap-3 p-4">
					<div className="min-w-0">
						<h1 className="font-bold text-2xl text-moss sm:text-3xl">
							{comName}
						</h1>
						<p className="text-bark text-xs italic">{sciName}</p>
					</div>
					<p className="text-muted-foreground text-sm">
						Not detected at this station yet. It will appear here the first time
						it is heard.
					</p>
					<SpeciesActions
						speciesLink={speciesLinkFor(sciName)}
						comName={comName}
						size="sm"
					/>
				</div>
			</Card>
		</PageWrap>
	);
}

function SpeciesNotFound() {
	const { comName } = Route.useParams();

	return (
		<PageWrap>
			<PageStatus
				tone="missing"
				title="No such bird"
				actions={
					<ButtonLink to="/birds" size="sm" icon={Feather}>
						Browse all species
					</ButtonLink>
				}
			>
				“{comName}” doesn’t match any bird this station’s classifier knows
				about. The address may be mistyped.
			</PageStatus>
		</PageWrap>
	);
}

function SpeciesDetailView({ detail }: { detail: SpeciesDetail }) {
	const { year, visits: visitsPage } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { weeks, maximum } = buildHeatMap(detail.history);
	const lastHeardDay = weeks
		.flatMap((week) => week.days)
		.filter(({ point }) => (point?.count ?? 0) > 0)
		.at(-1)?.date;
	const heatScrollRef = useRef<HTMLDivElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-aim trigger
	useEffect(() => {
		const el = heatScrollRef.current;
		if (el) el.scrollLeft = year === CURRENT_YEAR ? el.scrollWidth : 0;
	}, [year, detail.history]);
	const selectYear = (next: number) =>
		navigate({
			search: (prev) => ({ ...prev, year: next }),
			replace: true,
			resetScroll: false,
		});
	const selectVisitsPage = (next: number) =>
		navigate({
			search: (prev) => ({ ...prev, visits: next }),
			replace: true,
			resetScroll: false,
		});

	return (
		<TooltipProvider>
			<PageWrap className="@container/bird pt-0">
				<SummaryCard detail={detail} />

				<div className={COLUMNS_CLASS}>
					<Card
						as="section"
						aria-label="Detection history"
						className="overflow-hidden"
					>
						<CardHeader title="Detection history" className="flex-wrap">
							<div className="-my-1">
								<YearSelector
									year={year}
									years={detail.availableYears}
									onChange={selectYear}
								/>
							</div>
						</CardHeader>

						<div className="mt-page flex gap-2">
							<WeekdayLabels />
							<div
								ref={heatScrollRef}
								className="min-w-0 flex-1 overflow-x-auto pb-1"
							>
								<div className="w-max">
									<div className="mb-1 flex h-3 gap-1 leading-3">
										{weeks.map((week, index) => (
											<div
												key={`month-${week.days[0].date.toISOString()}`}
												className={`flex w-3 shrink-0 whitespace-nowrap text-[10px] text-muted-foreground ${index === weeks.length - 1 ? "justify-end" : ""}`}
											>
												{week.monthLabel}
											</div>
										))}
									</div>
									<fieldset
										aria-label={`Days with detections in ${year}. Arrow keys move between them.`}
										data-year-grid=""
										onKeyDown={walkYearGrid}
										className="flex w-max gap-1"
									>
										{weeks.map((week) => (
											<div
												key={`week-${week.days[0].date.toISOString()}`}
												className="flex shrink-0 flex-col gap-1"
											>
												{week.days.map(({ date, point }) => (
													<HeatMapDay
														key={date.toISOString()}
														date={date}
														point={point}
														maximum={maximum}
														isTabStop={date === lastHeardDay}
													/>
												))}
											</div>
										))}
									</fieldset>
								</div>
							</div>
						</div>
						<div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 max-[400px]:mt-2">
							<StationRecord detail={detail} />
							<HeatLegend />
						</div>
					</Card>

					<BestRecordingCard
						recording={detail.bestRecording}
						speciesName={detail.comName}
					/>

					<div className="grid min-w-0 @min-[80rem]/bird:grid-rows-2 gap-page">
						<DetectionsByHourCard
							activity={detail.hourActivity}
							info={HOUR_CARD_INFO}
							className="@min-[80rem]/bird:min-h-0"
						/>

						<DetectionsByMonthCard
							trend={detail.detectionTrend}
							className="@min-[80rem]/bird:min-h-0"
						/>
					</div>

					<VisitLogCard
						key={detail.comName}
						comName={detail.comName}
						totalVisits={detail.totalDetections}
						firstPage={{
							page: 1,
							visits: detail.recentVisits,
							generatedAt: detail.generatedAt,
						}}
						loadedPage={detail.visitLog}
						page={visitsPage}
						onPageChange={selectVisitsPage}
					/>
				</div>
			</PageWrap>
		</TooltipProvider>
	);
}

const LEGEND_SHARES = [0, 0.25, 0.5, 0.75, 1] as const;

function HeatLegend() {
	return (
		<div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
			<span>Less</span>
			{LEGEND_SHARES.map((share) => (
				<span
					key={share}
					className="size-3 rounded-[3px] border border-line"
					style={{ backgroundColor: heatColorAt(share) }}
				/>
			))}
			<span>More</span>
		</div>
	);
}

function WeekdayLabels() {
	return (
		<div className="flex w-7 shrink-0 flex-col gap-1 pt-4 text-[9px] text-muted-foreground leading-3">
			<span>Sun</span>
			<span>Mon</span>
			<span>Tue</span>
			<span>Wed</span>
			<span>Thu</span>
			<span>Fri</span>
			<span>Sat</span>
		</div>
	);
}

const PROFILE_CARD_CLASS =
	"mt-page grid overflow-hidden p-0 sm:grid-cols-[11.5rem_minmax(0,1fr)]";
const PROFILE_PORTRAIT_CLASS =
	"flex h-34 items-center justify-center overflow-hidden p-4 pb-0 sm:h-38 sm:self-center sm:pb-4";
const PROFILE_TEXT_CLASS =
	"flex min-w-0 flex-col justify-center gap-3 p-4 sm:min-h-39 sm:justify-between sm:pl-0";
const COLUMNS_CLASS =
	"mt-page grid @min-[80rem]/bird:grid-cols-[minmax(0,max-content)_minmax(20rem,1fr)] grid-cols-[minmax(0,1fr)] items-stretch gap-page";
const VISIT_LOG_BESIDE_CHARTS_CLASS =
	"@min-[80rem]/bird:h-0 @min-[80rem]/bird:min-h-full";
const VISIT_LOG_CLASS = `flex min-h-105 min-w-0 flex-col ${VISIT_LOG_BESIDE_CHARTS_CLASS}`;
const VISIT_LOG_SHORT_CLASS = `flex min-w-0 flex-col ${VISIT_LOG_BESIDE_CHARTS_CLASS}`;
const VISIT_LOG_CARD_CLASS = "@container flex min-h-0 flex-1 flex-col pb-0!";
const VISIT_LOG_SHORT_CARD_CLASS =
	"@container flex min-h-0 flex-initial flex-col pb-0!";
const VISIT_LIST_CLASS =
	"-mx-page max-h-127.5 grow divide-y overflow-y-auto @min-[80rem]/bird:max-h-none @min-[80rem]/bird:min-h-0";
const VISIT_LOG_HEADER_CLASS =
	"-mx-page -mt-page flex min-h-11.25 flex-wrap items-center justify-between gap-2 border-b px-page";
const VISIT_ROW_CLASS =
	"flex items-center @min-[26rem]:gap-3 gap-2 px-page py-1.75";
const VISIT_ROW_BUTTON = {
	size: "sm" as const,
	labelClassName: "@min-[26rem]:inline hidden",
	className: "@min-[26rem]:w-auto w-7 @min-[26rem]:px-3 px-0",
};
const VISIT_LOG_FOOTER_CLASS =
	"-mx-page mt-auto flex min-h-11.25 shrink-0 flex-wrap items-center gap-page border-t px-page py-1.5";

const SWATCH =
	"size-3 rounded-[3px] border border-line transition-[outline] hover:z-10 hover:outline hover:outline-2 hover:outline-hover-line hover:outline-offset-1";

function walkYearGrid(event: KeyboardEvent<HTMLFieldSetElement>) {
	const days = [...event.currentTarget.querySelectorAll("a")];
	const from = days.indexOf(document.activeElement as HTMLAnchorElement);
	if (from < 0) return;
	const moves: Record<string, number> = {
		ArrowRight: from + 1,
		ArrowDown: from + 1,
		ArrowLeft: from - 1,
		ArrowUp: from - 1,
		Home: 0,
		End: days.length - 1,
	};
	const target = days[moves[event.key]];
	if (!(event.key in moves)) return;
	event.preventDefault();
	if (!target) return;
	days[from].tabIndex = -1;
	target.tabIndex = 0;
	target.focus();
}

function HeatMapDay({
	date,
	point,
	maximum,
	isTabStop,
}: {
	date: Date;
	point: TrendPoint | null;
	maximum: number;
	isTabStop: boolean;
}) {
	const count = point?.count ?? 0;
	const dateLabel = formatDate(bucketForDate(date));
	const noun = count === 1 ? "detection" : "detections";
	const label = `${dateLabel}: ${count.toLocaleString()} ${noun}`;
	const fill = { backgroundColor: heatColor(count, maximum) };

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				{count > 0 ? (
					<Link
						to="/timeline"
						search={{ period: "day", date: bucketForDate(date) }}
						aria-label={label}
						tabIndex={isTabStop ? 0 : -1}
						className="block"
					>
						<div aria-hidden="true" className={SWATCH} style={fill} />
					</Link>
				) : (
					<div aria-hidden="true" className={SWATCH} style={fill} />
				)}
			</TooltipTrigger>
			<TooltipContent>
				{dateLabel} — {count.toLocaleString()} {noun}
			</TooltipContent>
		</Tooltip>
	);
}

function SummaryCard({ detail }: { detail: SpeciesDetail }) {
	const offsetMs = useAgeOffset(detail.generatedAt);
	const lastVisit = detail.recentVisits[0];
	const lastHeard = lastVisit
		? formatTimeAgo(lastVisit.ageMs + offsetMs)
		: formatHeardDate(detail.lastDetected.date);
	return (
		<Card as="section" aria-label="Bird profile" className={PROFILE_CARD_CLASS}>
			<div className={PROFILE_PORTRAIT_CLASS}>
				<SpeciesImage
					imageUrl={detail.imageUrl}
					alt={detail.comName}
					glyphClassName="size-16"
					cropToPainting
				/>
			</div>

			<div className={PROFILE_TEXT_CLASS}>
				<div className="min-w-0">
					<h1 className="font-bold text-2xl text-moss sm:text-3xl">
						{detail.comName}
					</h1>
					<p className="text-bark text-xs italic">{detail.sciName}</p>
				</div>

				<p className="text-muted-foreground text-sm tabular-nums">
					Last heard{" "}
					<span className="font-semibold text-foreground">{lastHeard}</span>
					{lastVisit && detail.lastDetected.date ? (
						<>
							{" "}
							on{" "}
							<span className="font-semibold text-foreground">
								{formatDate(detail.lastDetected.date)}
							</span>
							{detail.lastDetected.time ? (
								<>
									{" "}
									at{" "}
									<span className="font-semibold text-foreground">
										{formatTime(detail.lastDetected.time)}
									</span>
								</>
							) : null}
						</>
					) : null}
				</p>
				<SpeciesActions
					speciesLink={detail.speciesLink}
					comName={detail.comName}
					size="sm"
				/>
			</div>
		</Card>
	);
}

function StationRecord({ detail }: { detail: SpeciesDetail }) {
	const days = daysBetween(detail.firstDetected.date, detail.lastDetected.date);

	return (
		<p className="text-muted-foreground text-xs tabular-nums">
			<Count>{detail.totalDetections.toLocaleString()}</Count>{" "}
			{detail.totalDetections === 1 ? "detection" : "detections"}
			{days === null ? null : (
				<>
					{" "}
					over <Count>{days.toLocaleString()}</Count>{" "}
					{days === 1 ? "day" : "days"} on record
				</>
			)}
		</p>
	);
}

function daysBetween(first: string, last: string): number | null {
	if (!first || !last) return null;
	const start = Date.parse(`${first}T00:00:00Z`);
	const end = Date.parse(`${last}T00:00:00Z`);
	if (Number.isNaN(start) || Number.isNaN(end)) return null;
	return Math.round((end - start) / 86_400_000) + 1;
}

function formatHeardDate(date: string): string {
	return date ? formatDate(date) : "—";
}

function VisitLogCard({
	comName,
	totalVisits,
	firstPage,
	loadedPage,
	page: requestedPage,
	onPageChange,
}: {
	comName: string;
	totalVisits: number;
	firstPage: VisitPage;
	loadedPage: VisitPage;
	page: number;
	onPageChange: (page: number) => void;
}) {
	const canListen = useCanListen();
	const fetchVisits = useServerFn(getSpeciesVisits);
	const pageCount = visitPageCount(totalVisits);
	const page = Math.min(requestedPage, pageCount);
	const fromLoader =
		page === 1 ? firstPage : page === loadedPage.page ? loadedPage : undefined;
	const { data: fetched } = useQuery({
		queryKey: ["species-visits", comName, page],
		queryFn: () => fetchVisits({ data: { comName, page } }),
		enabled: !fromLoader,
	});
	const current = fromLoader ?? fetched;
	const [held, setHeld] = useState(current ?? firstPage);
	if (current && current !== held) setHeld(current);
	const shown = current ?? held;
	const offsetMs = useAgeOffset(shown.generatedAt);

	const loading = !current;
	const visits = shown.visits;
	const firstIndex = (shown.page - 1) * VISITS_PAGE_SIZE + 1;
	const lastIndex = firstIndex + visits.length - 1;

	return (
		<section
			aria-label="Visit log"
			className={pageCount > 1 ? VISIT_LOG_CLASS : VISIT_LOG_SHORT_CLASS}
		>
			<Card
				className={`${pageCount > 1 ? VISIT_LOG_CARD_CLASS : VISIT_LOG_SHORT_CARD_CLASS} ${visits.length === 0 ? "pb-4!" : ""}`}
			>
				<div className={VISIT_LOG_HEADER_CLASS}>
					<Kicker as="h2">Visit log</Kicker>
				</div>

				{visits.length === 0 ? (
					<EmptyNote>{EMPTY.window.birdVisits}</EmptyNote>
				) : (
					<RowWell
						as="ul"
						aria-busy={loading}
						data-scroll-reset=""
						className={`${VISIT_LIST_CLASS} transition-opacity max-[400px]:grid max-[400px]:grid-cols-[minmax(max-content,1fr)] max-[400px]:overflow-x-auto ${loading ? "opacity-50" : ""}`}
					>
						{visits.map((visit, i) => {
							const heardAt = formatDateTime(visit.date, visit.time);

							return (
								<li
									key={`${visit.date}-${visit.time}`}
									aria-label={`${heardAt}${visit.confidence != null ? `, ${formatConfidence(visit.confidence)} confidence` : ""}`}
									className={VISIT_ROW_CLASS}
								>
									<IndexDot index={firstIndex + i} widest={lastIndex} />
									<div className="min-w-0 flex-1 text-sm">
										<Link
											to="/timeline"
											search={{ period: "day", date: visit.date }}
											className="block max-w-fit truncate font-medium no-underline hover:underline"
										>
											<time dateTime={`${visit.date}T${visit.time}`}>
												{heardAt}
											</time>
										</Link>
										<div className="truncate text-muted-foreground text-xs">
											{formatTimeAgo(visit.ageMs + offsetMs)}
										</div>
									</div>

									<ConfidencePill
										confidence={visit.confidence}
										className="shrink-0"
									/>
									{canListen ? (
										<RecordingButton
											audioUrl={visit.audioUrl ?? null}
											speciesName={comName}
											{...VISIT_ROW_BUTTON}
										/>
									) : null}
								</li>
							);
						})}
					</RowWell>
				)}

				{visits.length > 0 ? (
					<div className={VISIT_LOG_FOOTER_CLASS}>
						<div className={PAGE_ROW_CLASS}>
							<PageRange first={firstIndex} last={lastIndex} />
							{pageCount > 1 ? (
								<PageStepper
									className="ml-auto"
									variant="ghost"
									label="Visit log pages"
									page={page}
									pageCount={pageCount}
									onPageChange={onPageChange}
								/>
							) : null}
						</div>
					</div>
				) : null}
			</Card>
		</section>
	);
}

import {
	keepPreviousData,
	type QueryKey,
	queryOptions,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import {
	CollageCard,
	CollageCardSkeleton,
} from "~/components/collage-card.tsx";
import {
	HeaderSunTimes,
	HeaderSunTimesSkeleton,
} from "~/components/species-by-hour-card.tsx";
import { WindowSummary } from "~/components/timeline/window-summary.tsx";
import {
	HOUR_BARS_MIN_PX,
	HourBarsCard,
	HourBarsCardSkeleton,
	sumHours,
} from "~/components/today/hour-bars-card.tsx";
import {
	RecentLogCard,
	RecentLogCardSkeleton,
} from "~/components/today/recent-log-card.tsx";
import {
	TodayHeader,
	TodayHeaderShell,
} from "~/components/today/today-header.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { announce } from "~/lib/announce.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { pageHead } from "~/lib/link-preview.ts";
import { prefetchInBrowser } from "~/lib/query-client.ts";
import type { WindowSun } from "~/lib/sun-times.ts";
import type { TimelineRow } from "~/lib/timeline.ts";
import { type TimelinePageData, timelineQuery } from "~/lib/timeline-page.ts";
import {
	getTodaySnapshot,
	type ShownDay,
	type TodaySnapshot,
} from "~/lib/today.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";

const POLL_INTERVAL_MS = 10_000;
const FLASH_DURATION_MS = 2_400;
const NEW_BIRD_ANNOUNCE_GAP_MS = 60_000;
// 9.875rem is the header at xl: its 7.75rem row, 1rem padding each side and a 2px border.
const WINDOW_FIT_CLASS =
	"xl:h-[calc(100dvh-9.875rem-3*var(--page-gap))] xl:min-h-[28rem]";
// Source order is the reading and tab order (Recent activity, Today, Hourly activity); from lg the
// grid places Hourly activity under Recent activity on the left and Today across both rows on the right.
const BODY_GRID_CLASS = `mt-page grid grid-cols-1 items-start gap-page lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[auto_1fr] xl:grid-rows-[auto_minmax(0,1fr)] xl:items-stretch ${WINDOW_FIT_CLASS}`;
const FEED_SLOT_CLASS = "min-w-0 lg:col-start-1 lg:row-start-1 xl:self-start";
const HOURS_SLOT_CLASS = "flex min-w-0 flex-col lg:col-start-1 lg:row-start-2";
const COLLAGE_SLOT_CLASS = "lg:col-start-2 lg:row-span-2 lg:row-start-1";
const COLLAGE_FIT_CLASS = `${COLLAGE_SLOT_CLASS} ${WINDOW_FIT_CLASS}`;
const COLLAGE_EMPTY_CLASS = `${COLLAGE_SLOT_CLASS} self-start`;
const DAY_LABEL: Record<ShownDay, string> = {
	today: "Today",
	yesterday: "Yesterday",
};

function useAnnounceNewBird(comName: string | null) {
	const spoken = useRef({ comName, at: 0 });
	useEffect(() => {
		const now = Date.now();
		if (!comName || comName === spoken.current.comName) return;
		if (now - spoken.current.at < NEW_BIRD_ANNOUNCE_GAP_MS) return;
		spoken.current = { comName, at: now };
		announce(`Now hearing ${comName}`);
	}, [comName]);
}

const snapshotQuery = queryOptions({
	queryKey: ["today-snapshot"],
	queryFn: () => getTodaySnapshot(),
	refetchInterval: POLL_INTERVAL_MS,
});

export const Route = createFileRoute("/today")({
	head: () =>
		pageHead(
			"Today",
			"What this station is hearing right now, identified as it sings.",
		),
	component: Today,
	loader: ({ context }) => {
		prefetchInBrowser(context.queryClient, snapshotQuery);
	},
});

function useFreshKeys(keys: string[]): Set<string> {
	const signature = keys.join("|");
	const seenRef = useRef(new Set(keys));
	const [freshKeys, setFreshKeys] = useState<Set<string>>(new Set());

	useEffect(() => {
		const currentKeys = signature.length > 0 ? signature.split("|") : [];
		const arrived = currentKeys.filter((key) => !seenRef.current.has(key));
		seenRef.current = new Set(currentKeys);
		if (arrived.length === 0) return;

		setFreshKeys(new Set(arrived));
		const timeout = setTimeout(
			() => setFreshKeys(new Set()),
			FLASH_DURATION_MS,
		);
		return () => clearTimeout(timeout);
	}, [signature]);

	return freshKeys;
}

function Today() {
	const snapshot = useSkeletonMinimum(useQuery(snapshotQuery).data);

	if (!snapshot) return <TodayShell />;
	return <TodayBody snapshot={snapshot} />;
}

const WIDE_QUERY = "(min-width: 80rem)";
const RECENT_LABEL = "Recent detections";

function useRowsThatFit(
	gridRef: RefObject<HTMLDivElement | null>,
	hasRows: boolean,
): number | undefined {
	const [rows, setRows] = useState<number>();
	useEffect(() => {
		const grid = gridRef.current;
		if (!grid || !hasRows) return;
		const measure = () => {
			const list = grid.querySelector(
				`section[aria-label="${RECENT_LABEL}"] ul`,
			);
			const card = list?.closest("section");
			const row = list?.children[1] ?? list?.children[0];
			if (!list || !card || !row || !window.matchMedia(WIDE_QUERY).matches) {
				setRows(undefined);
				return;
			}
			const gap = Number.parseFloat(getComputedStyle(grid).rowGap) || 0;
			const chrome =
				card.getBoundingClientRect().height -
				list.getBoundingClientRect().height;
			const room = grid.clientHeight - gap - HOUR_BARS_MIN_PX - chrome;
			setRows(
				Math.max(1, Math.floor(room / row.getBoundingClientRect().height)),
			);
		};
		const observer = new ResizeObserver(measure);
		observer.observe(grid);
		measure();
		return () => observer.disconnect();
	}, [gridRef, hasRows]);
	return rows;
}

function LiveLayout({
	header,
	hours,
	collage,
	feed,
	gridRef,
}: {
	header: ReactNode;
	hours: ReactNode;
	collage: ReactNode;
	feed: ReactNode;
	gridRef?: RefObject<HTMLDivElement | null>;
}) {
	return (
		<PageWrap>
			{header}
			<div ref={gridRef} className={BODY_GRID_CLASS}>
				<div className={FEED_SLOT_CLASS}>{feed}</div>
				{collage}
				<div className={HOURS_SLOT_CLASS}>{hours}</div>
			</div>
		</PageWrap>
	);
}

function TodayShell() {
	return (
		<LiveLayout
			header={<TodayHeaderShell />}
			feed={<RecentLogCardSkeleton day="today" />}
			hours={<HourBarsCardSkeleton />}
			collage={
				<CollageCardSkeleton
					title={DAY_LABEL.today}
					summary={<WindowSummary rows={null} />}
					trailing={<HeaderSunTimesSkeleton />}
					className={COLLAGE_FIT_CLASS}
				/>
			}
		/>
	);
}

function useRefetchOnNewDetection(
	latestKey: string | undefined,
	queryKey: QueryKey,
) {
	const queryClient = useQueryClient();
	const seen = useRef(latestKey);
	useEffect(() => {
		if (latestKey === seen.current) return;
		seen.current = latestKey;
		queryClient.invalidateQueries({ queryKey });
	}, [latestKey, queryKey, queryClient]);
}

function useCollageSpecies(rows: TimelineRow[] | null) {
	const signature = rows
		?.map((row) => `${row.comName}:${row.totalDetections}`)
		.join("|");
	// biome-ignore lint/correctness/useExhaustiveDependencies: a refetch returns new rows for the same birds; repack the collage only when the birds change
	return useMemo(
		() =>
			rows?.map((row) => ({
				comName: row.comName,
				sciName: row.sciName,
				count: row.totalDetections,
			})) ?? null,
		[signature],
	);
}

type DayBody = { rows: TimelineRow[]; sun: WindowSun };

function dayBody(page: TimelinePageData | undefined): DayBody | null {
	return page?.body.kind === "rows"
		? { rows: page.body.rows, sun: page.body.sun }
		: null;
}

function TodayBody({ snapshot }: { snapshot: TodaySnapshot }) {
	const dayQuery = timelineQuery({ period: "day", anchor: snapshot.date });
	const body = dayBody(
		useQuery({ ...dayQuery, placeholderData: keepPreviousData }).data,
	);
	const rows = body?.rows ?? null;
	const title = DAY_LABEL[snapshot.day];
	const sunTimes = body?.sun.available ? (
		<HeaderSunTimes sun={body.sun} />
	) : undefined;
	const collageSpecies = useCollageSpecies(rows);
	const heroKey = snapshot.current?.key;
	const freshKeys = useFreshKeys(snapshot.recent.map((visit) => visit.key));
	const freshHeroKeys = useFreshKeys(heroKey ? [heroKey] : []);
	const lastHour =
		snapshot.day === "today" ? Number(snapshot.generatedAt.slice(11, 13)) : 23;

	const gridRef = useRef<HTMLDivElement>(null);
	const rowsThatFit = useRowsThatFit(gridRef, snapshot.recent.length > 0);

	useRefetchOnNewDetection(heroKey, dayQuery.queryKey);
	useAnnounceNewBird(snapshot.current?.comName ?? null);

	return (
		<LiveLayout
			gridRef={gridRef}
			header={
				<TodayHeader
					current={snapshot.current}
					hasAnyDetections={snapshot.hasAnyDetections}
					generatedAt={snapshot.generatedAt}
					flash={heroKey !== undefined && freshHeroKeys.has(heroKey)}
				/>
			}
			feed={
				<RecentLogCard
					recent={snapshot.recent}
					day={snapshot.day}
					date={snapshot.date}
					generatedAt={snapshot.generatedAt}
					freshKeys={freshKeys}
					limit={rowsThatFit}
				/>
			}
			hours={
				rows ? (
					<HourBarsCard hours={sumHours(rows)} lastHour={lastHour} />
				) : (
					<HourBarsCardSkeleton />
				)
			}
			collage={
				collageSpecies ? (
					<CollageCard
						species={collageSpecies}
						emptyMessage={EMPTY.window.today}
						title={title}
						summary={<WindowSummary rows={rows} />}
						trailing={sunTimes}
						reshuffle={false}
						className={
							collageSpecies.length > 0
								? COLLAGE_FIT_CLASS
								: COLLAGE_EMPTY_CLASS
						}
					/>
				) : (
					<CollageCardSkeleton
						title={title}
						summary={<WindowSummary rows={null} />}
						trailing={<HeaderSunTimesSkeleton />}
						className={COLLAGE_FIT_CLASS}
					/>
				)
			}
		/>
	);
}

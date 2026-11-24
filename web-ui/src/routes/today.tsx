import {
	keepPreviousData,
	type QueryKey,
	queryOptions,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Sun } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
	CollageCard,
	CollageCardSkeleton,
} from "~/components/collage-card.tsx";
import {
	HourBarsCard,
	HourBarsCardSkeleton,
	sumHours,
} from "~/components/hour-bars-card.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { WindowSummary } from "~/components/timeline/window-summary.tsx";
import {
	VisitsCard,
	VisitsCardSkeleton,
} from "~/components/today/visits-card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { announce } from "~/lib/announce.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { pageHead } from "~/lib/link-preview.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { prefetchInBrowser } from "~/lib/query-client.ts";
import type { TimelineRow } from "~/lib/timeline.ts";
import { type TimelinePageData, timelineQuery } from "~/lib/timeline-page.ts";
import { getTodaySnapshot, type TodaySnapshot } from "~/lib/today.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";

const POLL_INTERVAL_MS = 10_000;
const FLASH_DURATION_MS = 2_400;
const NEW_BIRD_ANNOUNCE_GAP_MS = 60_000;
const WINDOW_FIT_CLASS =
	"min-[1800px]:h-[calc(100dvh-var(--masthead-h)-3*var(--page-gap))]! min-[1800px]:min-h-[28rem]";
// Source order is the stacked order (Activity, Hourly activity, Visit log); from 1800px the
// grid puts Activity across both rows on the left and Hourly activity under Visit log on the right.
const BODY_GRID_CLASS = `mt-page grid grid-cols-1 items-start gap-page min-[1800px]:grid-cols-[72rem_minmax(0,1fr)] min-[1800px]:grid-rows-[minmax(0,1fr)_auto] min-[1800px]:items-stretch ${WINDOW_FIT_CLASS}`;
const FEED_SLOT_CLASS =
	"flex min-h-0 min-w-0 flex-col min-[1800px]:col-start-2 min-[1800px]:row-start-1";
const HOURS_SLOT_CLASS =
	"flex min-w-0 flex-col min-[1800px]:col-start-2 min-[1800px]:row-start-2";
const COLLAGE_SLOT_CLASS =
	"min-w-0 min-[1800px]:col-start-1 min-[1800px]:row-span-2 min-[1800px]:row-start-1";
const COLLAGE_FIT_CLASS = `${COLLAGE_SLOT_CLASS} ${WINDOW_FIT_CLASS}`;
const COLLAGE_EMPTY_CLASS = `${COLLAGE_SLOT_CLASS} self-start`;

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
			"A live view of the day's bird activity at this station.",
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
	const loaded = useQuery(snapshotQuery).data;
	const dayQuery = timelineQuery({
		period: "day",
		anchor: loaded?.date ?? "",
	});
	const loadedDay = useQuery({
		...dayQuery,
		enabled: loaded !== undefined,
		placeholderData: keepPreviousData,
	}).data;
	const snapshot = useSkeletonMinimum(loaded);
	const rows = useSkeletonMinimum(loaded ? dayRows(loadedDay) : undefined);
	const collageSpecies = useCollageSpecies(rows);

	return (
		<LiveLayout
			feed={
				snapshot ? (
					<VisitFeed snapshot={snapshot} dayQueryKey={dayQuery.queryKey} />
				) : (
					<VisitsCardSkeleton />
				)
			}
			hours={
				snapshot && rows ? (
					<HourBarsCard
						hours={sumHours(rows)}
						lastHour={lastHourOf(snapshot)}
					/>
				) : (
					<HourBarsCardSkeleton />
				)
			}
			collage={
				snapshot && rows && collageSpecies ? (
					<CollageCard
						species={collageSpecies}
						emptyMessage={EMPTY.window.today}
						summary={
							<WindowSummary
								rows={rows}
								label={snapshot.day === "yesterday" ? "Yesterday" : undefined}
							/>
						}
						className={
							collageSpecies.length > 0
								? COLLAGE_FIT_CLASS
								: COLLAGE_EMPTY_CLASS
						}
					/>
				) : (
					<CollageCardSkeleton
						summary={<WindowSummary rows={null} />}
						className={COLLAGE_FIT_CLASS}
					/>
				)
			}
		/>
	);
}

function LiveLayout({
	hours,
	collage,
	feed,
}: {
	hours: ReactNode;
	collage: ReactNode;
	feed: ReactNode;
}) {
	return (
		<PageWrap>
			<PageHeaderCard
				icon={Sun}
				title={PAGE_HEADERS.today.title}
				description={PAGE_HEADERS.today.description}
			/>
			<div className={BODY_GRID_CLASS}>
				{collage}
				<div className={HOURS_SLOT_CLASS}>{hours}</div>
				<div className={FEED_SLOT_CLASS}>{feed}</div>
			</div>
		</PageWrap>
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

function useCollageSpecies(rows: TimelineRow[] | undefined) {
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

function dayRows(
	page: TimelinePageData | undefined,
): TimelineRow[] | undefined {
	return page?.body.kind === "rows" ? page.body.rows : undefined;
}

function lastHourOf(snapshot: TodaySnapshot): number {
	return snapshot.day === "today"
		? Number(snapshot.generatedAt.slice(11, 13))
		: 23;
}

function VisitFeed({
	snapshot,
	dayQueryKey,
}: {
	snapshot: TodaySnapshot;
	dayQueryKey: QueryKey;
}) {
	const newest = snapshot.visits.at(0);
	const freshKeys = useFreshKeys(
		snapshot.visits.map((visit) => visit.latestKey),
	);

	useRefetchOnNewDetection(newest?.latestKey, dayQueryKey);
	useAnnounceNewBird(newest?.comName ?? null);

	return (
		<VisitsCard
			visits={snapshot.visits}
			generatedAt={snapshot.generatedAt}
			freshKeys={freshKeys}
		/>
	);
}

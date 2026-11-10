import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { HighlightsCard } from "~/components/highlights-card.tsx";
import { CurrentBirdCard } from "~/components/now/current-bird-card.tsx";
import { LiveAudioCard } from "~/components/now/live-audio-card.tsx";
import {
	RecentLogCard,
	RecentLogCardSkeleton,
} from "~/components/now/recent-log-card.tsx";
import { SpeciesHeroCardShell } from "~/components/species-hero-card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { announce } from "~/lib/announce.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { pageHead } from "~/lib/link-preview.ts";
import {
	getLiveHighlights,
	type LiveHighlights,
} from "~/lib/live-highlights.ts";
import { getNowSnapshot, type NowSnapshot } from "~/lib/now.ts";
import { PAGE_QUERY, prefetchInBrowser } from "~/lib/query-client.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";

const POLL_INTERVAL_MS = 10_000;
const FLASH_DURATION_MS = 2_400;
const NEW_BIRD_ANNOUNCE_GAP_MS = 60_000;
const HIGHLIGHTS_EMPTY = EMPTY.window.last24Hours;

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
	queryKey: ["now-snapshot"],
	queryFn: () => getNowSnapshot(),
	refetchInterval: POLL_INTERVAL_MS,
});

const highlightsQuery = queryOptions({
	...PAGE_QUERY,
	queryKey: ["live-highlights"],
	queryFn: () => getLiveHighlights(),
});

export const Route = createFileRoute("/live")({
	head: () =>
		pageHead(
			"Live",
			"What this station is hearing right now, identified as it sings.",
		),
	component: Live,
	loader: ({ context }) => {
		prefetchInBrowser(context.queryClient, snapshotQuery);
		prefetchInBrowser(context.queryClient, highlightsQuery);
		return { unlocked: context.auth.unlocked };
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

function Live() {
	const { unlocked } = Route.useLoaderData();
	const snapshot = useSkeletonMinimum(useQuery(snapshotQuery).data);
	const highlights = useSkeletonMinimum(useQuery(highlightsQuery).data);

	if (!snapshot) return <LiveShell unlocked={unlocked} />;
	return (
		<LiveBody snapshot={snapshot} highlights={highlights} unlocked={unlocked} />
	);
}

function LiveShell({ unlocked }: { unlocked: boolean }) {
	return (
		<PageWrap>
			<SpeciesHeroCardShell label="Last 24 hours" />

			<div className="mt-page grid grid-cols-1 items-start gap-page lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
				<RecentLogCardSkeleton />

				<div className="grid grid-cols-1 gap-page">
					<LiveAudioCard unlocked={unlocked} />
					<div>
						<HighlightsCard
							highlights={null}
							period="live"
							emptyMessage={HIGHLIGHTS_EMPTY}
						/>
					</div>
				</div>
			</div>
		</PageWrap>
	);
}

function LiveBody({
	snapshot,
	highlights,
	unlocked,
}: {
	snapshot: NowSnapshot;
	highlights: LiveHighlights | undefined;
	unlocked: boolean;
}) {
	const freshKeys = useFreshKeys(snapshot.recent.map((row) => row.key));

	useAnnounceNewBird(snapshot.current?.comName ?? null);

	const heroKey = snapshot.current?.key;
	const freshHeroKeys = useFreshKeys(heroKey ? [heroKey] : []);
	const heroIsNew = heroKey !== undefined && freshHeroKeys.has(heroKey);

	return (
		<PageWrap>
			<CurrentBirdCard
				current={snapshot.current}
				hasAnyDetections={snapshot.hasAnyDetections}
				generatedAt={snapshot.generatedAt}
				flash={heroIsNew}
			/>

			<div className="mt-page grid grid-cols-1 items-start gap-page lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
				<RecentLogCard
					recent={snapshot.recent}
					generatedAt={snapshot.generatedAt}
					freshKeys={freshKeys}
				/>

				<div className="grid grid-cols-1 gap-page">
					<LiveAudioCard unlocked={unlocked} />

					<HighlightsCard
						highlights={highlights?.highlights ?? null}
						thresholds={highlights?.thresholds}
						period="live"
						emptyMessage={HIGHLIGHTS_EMPTY}
					/>
				</div>
			</div>
		</PageWrap>
	);
}

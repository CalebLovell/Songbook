import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Deferred, ShellReveal } from "~/components/deferred.tsx";
import { HighlightsCard } from "~/components/highlights-card.tsx";
import { CurrentBirdCard } from "~/components/now/current-bird-card.tsx";
import { LiveAudioCard } from "~/components/now/live-audio-card.tsx";
import { LivePill, LivePillSkeleton } from "~/components/now/live-pill.tsx";
import {
	RecentLogCard,
	RecentLogCardSkeleton,
} from "~/components/now/recent-log-card.tsx";
import { SpeciesHeroCardShell } from "~/components/species-hero-card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import {
	getLiveHighlights,
	type LiveHighlights,
} from "~/lib/live-highlights.ts";
import { getNowSnapshot, type NowSnapshot } from "~/lib/now.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { getStationStatus } from "~/lib/station-status.ts";
import { usePolledData } from "~/lib/use-polled-data.ts";

const POLL_INTERVAL_MS = 10_000;
const STATUS_INTERVAL_MS = 30_000;
const FLASH_DURATION_MS = 2_400;
const HIGHLIGHTS_EMPTY = EMPTY.window.last24Hours;

export const Route = createFileRoute("/live")({
	head: () => ({ meta: [{ title: pageTitle("Live") }] }),
	component: Live,
	loader: ({ context }) => ({
		snapshot: getNowSnapshot(),
		status: getStationStatus(),
		highlights: getLiveHighlights(),
		unlocked: context.auth.unlocked,
	}),
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
	const {
		snapshot: initialSnapshot,
		status: initialStatus,
		highlights,
		unlocked,
	} = Route.useLoaderData();
	const { data: snapshot } = usePolledData(
		() => getNowSnapshot(),
		initialSnapshot,
		POLL_INTERVAL_MS,
	);
	const { data: status } = usePolledData(
		() => getStationStatus(),
		initialStatus,
		STATUS_INTERVAL_MS,
	);
	const pill = status ? <LivePill status={status} /> : <LivePillSkeleton />;

	if (!snapshot) return <LiveShell unlocked={unlocked} pill={pill} />;
	return (
		<LiveBody
			snapshot={snapshot}
			highlights={highlights}
			unlocked={unlocked}
			pill={pill}
		/>
	);
}

function LiveShell({ unlocked, pill }: { unlocked: boolean; pill: ReactNode }) {
	return (
		<PageWrap>
			<SpeciesHeroCardShell label="Last 24 hours" actions={pill} />

			<div className="mt-page grid grid-cols-1 items-start gap-page lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
				<RecentLogCardSkeleton />

				<div className="grid grid-cols-1 gap-page">
					<LiveAudioCard unlocked={unlocked} />
					<ShellReveal>
						<HighlightsCard
							highlights={null}
							period="live"
							emptyMessage={HIGHLIGHTS_EMPTY}
						/>
					</ShellReveal>
				</div>
			</div>
		</PageWrap>
	);
}

function LiveBody({
	snapshot,
	highlights,
	unlocked,
	pill,
}: {
	snapshot: NowSnapshot;
	highlights: Promise<LiveHighlights>;
	unlocked: boolean;
	pill: ReactNode;
}) {
	const freshKeys = useFreshKeys(snapshot.recent.map((row) => row.key));

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
				pill={pill}
			/>

			<div className="mt-page grid grid-cols-1 items-start gap-page lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
				<RecentLogCard
					recent={snapshot.recent}
					generatedAt={snapshot.generatedAt}
					freshKeys={freshKeys}
				/>

				<div className="grid grid-cols-1 gap-page">
					<LiveAudioCard unlocked={unlocked} />

					<Deferred
						promise={highlights}
						shell={
							<HighlightsCard
								highlights={null}
								period="live"
								emptyMessage={HIGHLIGHTS_EMPTY}
							/>
						}
					>
						{(judged) => (
							<HighlightsCard
								highlights={judged.highlights}
								thresholds={judged.thresholds}
								period="live"
								emptyMessage={HIGHLIGHTS_EMPTY}
							/>
						)}
					</Deferred>
				</div>
			</div>
		</PageWrap>
	);
}

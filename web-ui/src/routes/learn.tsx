import {
	createFileRoute,
	stripSearchParams,
	useRouter,
} from "@tanstack/react-router";
import { Lightbulb, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
	LearnGame,
	LearnGameEmpty,
	LearnGameSkeleton,
} from "~/components/learn/learn-game.tsx";
import { LearnPoolSelector } from "~/components/learn/learn-layout.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { getLearnRound } from "~/lib/learn.ts";
import { LEARN_POOLS, type LearnPool } from "~/lib/learn-pools.ts";
import {
	type GameProgress,
	loadResumableGame,
	saveGame,
} from "~/lib/learn-saved-game.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { useHeldRound } from "~/lib/use-held-round.ts";

const DEFAULT_POOL: LearnPool = "common";

const learnSearchSchema = z.object({
	pool: z.enum(LEARN_POOLS).default(DEFAULT_POOL).catch(DEFAULT_POOL),
});

export const Route = createFileRoute("/learn")({
	head: () => ({ meta: [{ title: pageTitle("Learn") }] }),
	validateSearch: learnSearchSchema,
	search: {
		middlewares: [stripSearchParams({ pool: DEFAULT_POOL })],
	},
	loaderDeps: ({ search }) => ({ pool: search.pool }),
	loader: ({ deps }) => ({ round: getLearnRound({ data: deps.pool }) }),
	component: Learn,
});

type LoadedRound = Awaited<ReturnType<typeof getLearnRound>>;

function Learn() {
	const { round: roundPromise } = Route.useLoaderData();
	const { pool } = Route.useSearch();
	const navigate = Route.useNavigate();

	const [loaded, setLoaded] = useState<{
		data: LoadedRound;
		pool: LearnPool;
		from: Promise<LoadedRound>;
	} | null>(null);
	useEffect(() => {
		let cancelled = false;
		roundPromise.then(
			(data) => {
				if (!cancelled) setLoaded({ data, pool, from: roundPromise });
			},
			() => {},
		);
		return () => {
			cancelled = true;
		};
	}, [roundPromise, pool]);
	const forPool = loaded?.pool === pool ? loaded : null;
	const [isConfirmingNewRound, setIsConfirmingNewRound] = useState(false);
	const [newRoundRequests, setNewRoundRequests] = useState(0);
	const hasRound = (forPool?.data.round.questions.length ?? 0) > 0;
	const [isRoundFinished, setIsRoundFinished] = useState(false);

	return (
		<div className="page-wrap py-4">
			<PageHeaderCard
				icon={Lightbulb}
				title={PAGE_HEADERS.learn.title}
				description={PAGE_HEADERS.learn.description}
			/>

			<LearnPoolSelector
				pool={pool}
				poolCounts={loaded?.data.poolCounts ?? null}
				onPoolChange={(value) => {
					navigate({
						search: (previous) => ({ ...previous, pool: value }),
						replace: true,
					});
				}}
				onNewRound={
					hasRound && !isRoundFinished
						? () => setIsConfirmingNewRound(true)
						: undefined
				}
			/>

			<div className="mt-page w-full">
				{forPool ? (
					<LearnRoundView
						key={pool}
						loaded={forPool.data}
						pool={pool}
						isLoadingNextRound={forPool.from !== roundPromise}
						newRoundRequests={newRoundRequests}
						isPaused={isConfirmingNewRound}
						onFinishedChange={setIsRoundFinished}
					/>
				) : (
					<LearnGameSkeleton />
				)}
			</div>

			{isConfirmingNewRound ? (
				<ConfirmDialog
					title="Restart the round?"
					description="This round's answers and score are lost, and a new set of calls is dealt."
					confirmIcon={RotateCcw}
					confirmLabel="Restart"
					destructive
					onCancel={() => setIsConfirmingNewRound(false)}
					onConfirm={() => {
						setIsConfirmingNewRound(false);
						setNewRoundRequests((count) => count + 1);
					}}
				/>
			) : null}
		</div>
	);
}

function LearnRoundView({
	loaded,
	pool,
	isLoadingNextRound,
	newRoundRequests,
	isPaused,
	onFinishedChange,
}: {
	loaded: LoadedRound;
	pool: LearnPool;
	isLoadingNextRound: boolean;
	newRoundRequests: number;
	isPaused: boolean;
	onFinishedChange: (isFinished: boolean) => void;
}) {
	const router = useRouter();
	const [saved] = useState(() => loadResumableGame(pool, loaded.round));
	const { round, requestNextRound } = useHeldRound(
		loaded.round,
		pool,
		saved?.round,
	);
	const onProgressChange = useCallback(
		(progress: GameProgress) => {
			saveGame(pool, { round, progress });
			onFinishedChange(progress.isFinished);
		},
		[pool, round, onFinishedChange],
	);
	const playAgain = () => {
		requestNextRound();
		router.invalidate();
	};

	const handledRequests = useRef(newRoundRequests);
	useEffect(() => {
		if (newRoundRequests === handledRequests.current) return;
		handledRequests.current = newRoundRequests;
		playAgain();
	});

	return round.questions.length === 0 ? (
		<EmptyPool hasAnyDetections={loaded.hasAnyDetections} />
	) : (
		<LearnGame
			key={round.id}
			round={round}
			rareMax={loaded.rareMax}
			initialProgress={
				saved?.round.id === round.id ? saved.progress : undefined
			}
			onProgressChange={onProgressChange}
			onPlayAgain={playAgain}
			isLoadingNextRound={isLoadingNextRound}
			isPaused={isPaused}
		/>
	);
}

function EmptyPool({ hasAnyDetections }: { hasAnyDetections: boolean }) {
	return (
		<LearnGameEmpty
			message={
				hasAnyDetections ? EMPTY.filter.learnPool : EMPTY.station.recordings
			}
		/>
	);
}

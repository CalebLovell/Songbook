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
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { getLearnRound } from "~/lib/learn.ts";
import { LEARN_POOLS, type LearnPool } from "~/lib/learn-pools.ts";
import {
	type GameProgress,
	loadResumableGame,
	saveGame,
} from "~/lib/learn-saved-game.ts";
import { pageHead } from "~/lib/link-preview.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { useHeldRound } from "~/lib/use-held-round.ts";

const DEFAULT_POOL: LearnPool = "common";

const learnSearchSchema = z.object({
	pool: z.enum(LEARN_POOLS).default(DEFAULT_POOL).catch(DEFAULT_POOL),
});

export const Route = createFileRoute("/learn")({
	head: () =>
		pageHead(
			"Learn",
			"Learn the birds at this station by ear, using their own recordings.",
		),
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
	const hasRound = (forPool?.data.round.questions.length ?? 0) > 0;
	const [isRoundFinished, setIsRoundFinished] = useState(false);

	return (
		<PageWrap>
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
						isConfirmingNewRound={isConfirmingNewRound}
						onConfirmingDone={() => setIsConfirmingNewRound(false)}
						onFinishedChange={setIsRoundFinished}
					/>
				) : (
					<LearnGameSkeleton />
				)}
			</div>
		</PageWrap>
	);
}

function LearnRoundView({
	loaded,
	pool,
	isLoadingNextRound,
	isConfirmingNewRound,
	onConfirmingDone,
	onFinishedChange,
}: {
	loaded: LoadedRound;
	pool: LearnPool;
	isLoadingNextRound: boolean;
	isConfirmingNewRound: boolean;
	onConfirmingDone: () => void;
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
	const dealtByPlayer = useRef(false);
	const playAgain = () => {
		dealtByPlayer.current = true;
		requestNextRound();
		router.invalidate();
	};

	return round.questions.length === 0 ? (
		<EmptyPool hasAnyDetections={loaded.hasAnyDetections} />
	) : (
		<>
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
				isPaused={isConfirmingNewRound}
				focusClipOnStart={dealtByPlayer.current}
			/>
			{isConfirmingNewRound ? (
				<ConfirmDialog
					title="Restart the round?"
					description="This round's answers and score are lost, and a new set of calls is dealt."
					confirmIcon={RotateCcw}
					confirmLabel="Restart"
					destructive
					onCancel={onConfirmingDone}
					onConfirm={() => {
						onConfirmingDone();
						playAgain();
					}}
				/>
			) : null}
		</>
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

import {
	keepPreviousData,
	queryOptions,
	useQuery,
} from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { Lightbulb, RotateCcw } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
import { toast } from "~/components/ui/toaster.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { getLearnRound } from "~/lib/learn.ts";
import { LEARN_POOLS, type LearnPool } from "~/lib/learn-pools.ts";
import type { GameProgress } from "~/lib/learn-progress.ts";
import { loadResumableGame, saveGame } from "~/lib/learn-saved-game.ts";
import { pageHead } from "~/lib/link-preview.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { PAGE_QUERY, prefetchInBrowser } from "~/lib/query-client.ts";
import { useHeldRound } from "~/lib/use-held-round.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";

const DEFAULT_POOL: LearnPool = "common";

const learnSearchSchema = z.object({
	pool: z.enum(LEARN_POOLS).default(DEFAULT_POOL).catch(DEFAULT_POOL),
});

const learnRoundQuery = (pool: LearnPool) =>
	queryOptions({
		...PAGE_QUERY,
		queryKey: ["learn-round", pool],
		queryFn: () => getLearnRound({ data: pool }),
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
	loader: ({ context, deps }) => {
		prefetchInBrowser(context.queryClient, learnRoundQuery(deps.pool));
	},
	component: Learn,
});

type LoadedRound = Awaited<ReturnType<typeof getLearnRound>>;

function Learn() {
	const { pool } = Route.useSearch();
	const navigate = Route.useNavigate();

	const roundQuery = useQuery({
		...learnRoundQuery(pool),
		placeholderData: keepPreviousData,
	});
	const forPool = useSkeletonMinimum(
		roundQuery.isPlaceholderData ? undefined : roundQuery.data,
	);
	const [isConfirmingNewRound, setIsConfirmingNewRound] = useState(false);
	const hasRound = (forPool?.round.questions.length ?? 0) > 0;
	const [isRoundFinished, setIsRoundFinished] = useState(false);
	const dealNextRound = async () => (await roundQuery.refetch()).isSuccess;

	return (
		<PageWrap>
			<PageHeaderCard
				icon={Lightbulb}
				title={PAGE_HEADERS.learn.title}
				description={PAGE_HEADERS.learn.description}
			/>

			<LearnPoolSelector
				pool={pool}
				poolCounts={roundQuery.data?.poolCounts ?? null}
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
						loaded={forPool}
						pool={pool}
						isLoadingNextRound={roundQuery.isFetching}
						dealNextRound={dealNextRound}
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
	dealNextRound,
	isConfirmingNewRound,
	onConfirmingDone,
	onFinishedChange,
}: {
	loaded: LoadedRound;
	pool: LearnPool;
	isLoadingNextRound: boolean;
	dealNextRound: () => Promise<boolean>;
	isConfirmingNewRound: boolean;
	onConfirmingDone: () => void;
	onFinishedChange: (isFinished: boolean) => void;
}) {
	const [saved] = useState(() => loadResumableGame(pool, loaded.round));
	const { round, requestNextRound, cancelNextRound } = useHeldRound(
		loaded.round,
		pool,
		saved?.round,
	);
	const onProgressChange = useCallback(
		(progress: GameProgress) => {
			saveGame(pool, { round, progress });
			onFinishedChange(progress.phase === "finished");
		},
		[pool, round, onFinishedChange],
	);
	const dealtByPlayer = useRef(false);
	const playAgain = async () => {
		dealtByPlayer.current = true;
		requestNextRound();
		if (await dealNextRound()) return;
		cancelNextRound();
		toast.error("A new round couldn't be dealt.", {
			description: "Please try again.",
		});
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

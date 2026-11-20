import {
	keepPreviousData,
	queryOptions,
	useQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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

const learnSearchSchema = z.object({
	pool: z.enum(LEARN_POOLS).optional().catch(undefined),
});

const learnRoundQuery = (pool: LearnPool | undefined) =>
	queryOptions({
		...PAGE_QUERY,
		queryKey: ["learn-round", pool ?? "default"],
		queryFn: () => getLearnRound({ data: pool ?? null }),
	});

export const Route = createFileRoute("/learn")({
	head: () =>
		pageHead(
			"Learn",
			"Learn the birds at this station by ear, using their own recordings.",
		),
	validateSearch: learnSearchSchema,
	loaderDeps: ({ search }) => ({ pool: search.pool }),
	loader: ({ context, deps }) => {
		prefetchInBrowser(context.queryClient, learnRoundQuery(deps.pool));
	},
	component: Learn,
});

const SETTLING_NOTICE =
	"This station is new, so Common, Uncommon and Rare will shift as more birds are heard.";

type LoadedRound = Awaited<ReturnType<typeof getLearnRound>>;

function Learn() {
	const { pool: chosenPool } = Route.useSearch();
	const navigate = Route.useNavigate();

	const roundQuery = useQuery({
		...learnRoundQuery(chosenPool),
		placeholderData: keepPreviousData,
	});
	const pool = chosenPool ?? roundQuery.data?.pool;
	const forPool = useSkeletonMinimum(
		roundQuery.isPlaceholderData ? undefined : roundQuery.data,
	);
	const notice = roundQuery.data?.isSettling ? SETTLING_NOTICE : undefined;
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
						key={forPool.pool}
						loaded={forPool}
						pool={forPool.pool}
						isLoadingNextRound={roundQuery.isFetching}
						dealNextRound={dealNextRound}
						isConfirmingNewRound={isConfirmingNewRound}
						onConfirmingDone={() => setIsConfirmingNewRound(false)}
						onFinishedChange={setIsRoundFinished}
						notice={notice}
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
	notice,
}: {
	loaded: LoadedRound;
	pool: LearnPool;
	isLoadingNextRound: boolean;
	dealNextRound: () => Promise<boolean>;
	isConfirmingNewRound: boolean;
	onConfirmingDone: () => void;
	onFinishedChange: (isFinished: boolean) => void;
	notice?: string;
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
		<EmptyPool hasAnyDetections={loaded.hasAnyDetections} notice={notice} />
	) : (
		<>
			<LearnGame
				key={round.id}
				round={round}
				thresholds={loaded.thresholds}
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

function EmptyPool({
	hasAnyDetections,
	notice,
}: {
	hasAnyDetections: boolean;
	notice?: string;
}) {
	return (
		<LearnGameEmpty
			notice={notice}
			message={
				hasAnyDetections ? EMPTY.filter.learnPool : EMPTY.station.recordings
			}
		/>
	);
}

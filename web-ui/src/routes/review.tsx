import {
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert, SearchCheck } from "lucide-react";
import { Deferred } from "~/components/deferred.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import {
	ReviewWorkflow,
	ReviewWorkflowSkeleton,
} from "~/components/review/review-workflow.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { pageHead } from "~/lib/link-preview.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { PAGE_QUERY, prefetchInBrowser } from "~/lib/query-client.ts";
import { requireUnlocked } from "~/lib/require-unlocked.ts";
import {
	confirmReviewDetection,
	deleteReviewDetection,
	getReviewPage,
	getReviewSpecies,
	recategorizeReviewDetection,
} from "~/lib/review.ts";
import {
	type ReviewSearch,
	reviewSearchSchema,
	type SpeciesOption,
} from "~/lib/review-data.ts";

const reviewQuery = (data: ReviewSearch) =>
	queryOptions({
		...PAGE_QUERY,
		queryKey: ["review", data],
		queryFn: async () => {
			const [page, species] = await Promise.all([
				getReviewPage({ data }),
				getReviewSpecies(),
			]);
			return { page, species };
		},
	});

export const Route = createFileRoute("/review")({
	head: () => pageHead("Review"),
	validateSearch: reviewSearchSchema,
	beforeLoad: ({ context, location }) =>
		requireUnlocked(context.auth, location),
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps }) => {
		prefetchInBrowser(context.queryClient, reviewQuery(deps));
	},
	component: Review,
});

function Review() {
	const search = Route.useSearch();
	const queue = useQuery(reviewQuery(search));
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const correct = useServerFn(confirmReviewDetection),
		recategorize = useServerFn(recategorizeReviewDetection),
		remove = useServerFn(deleteReviewDetection);
	const change = useMutation({
		mutationFn: async (work: () => Promise<unknown>) => {
			await work();
			await queryClient.invalidateQueries();
		},
	});
	const run = (work: () => Promise<unknown>) =>
		change.mutateAsync(work).catch(() => {});
	return (
		<PageWrap className="space-y-page">
			<PageHeaderCard
				icon={SearchCheck}
				title={PAGE_HEADERS.review.title}
				description={PAGE_HEADERS.review.description}
			/>
			{change.isError ? (
				<p className="flex items-center gap-2 text-destructive text-sm">
					<CircleAlert className="size-4" />
					The detection could not be changed. Check the recording and try again.
				</p>
			) : null}
			<Deferred
				key={JSON.stringify(search)}
				query={queue}
				shell={<ReviewWorkflowSkeleton />}
			>
				{(loaded) => (
					<ReviewWorkflow
						key={loaded.page.page}
						page={loaded.page}
						species={loaded.species}
						busy={change.isPending || queue.isFetching}
						onCorrect={(rowId) => run(() => correct({ data: { rowId } }))}
						onRecategorize={(rowId: number, item: SpeciesOption) =>
							run(() => recategorize({ data: { rowId, ...item } }))
						}
						onDelete={(rowId) => run(() => remove({ data: { rowId } }))}
						onPageChange={(next) =>
							navigate({ search: { ...search, page: next } })
						}
					/>
				)}
			</Deferred>
		</PageWrap>
	);
}

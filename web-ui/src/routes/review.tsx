import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleAlert, SearchCheck } from "lucide-react";
import { Deferred } from "~/components/deferred.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import {
	ReviewWorkflow,
	ReviewWorkflowSkeleton,
} from "~/components/review/review-workflow.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { pageTitle } from "~/lib/page-title.ts";
import { requireUnlocked } from "~/lib/require-unlocked.ts";
import {
	confirmReviewDetection,
	deleteReviewDetection,
	getReviewPage,
	getReviewSpecies,
	recategorizeReviewDetection,
} from "~/lib/review.ts";
import {
	normalizeReviewSearch,
	type SpeciesOption,
} from "~/lib/review-data.ts";
import { useSettled } from "~/lib/use-settled.ts";

export const Route = createFileRoute("/review")({
	head: () => ({ meta: [{ title: pageTitle("Review") }] }),
	validateSearch: normalizeReviewSearch,
	beforeLoad: ({ context, location }) =>
		requireUnlocked(context.auth, location),
	loaderDeps: ({ search }) => search,
	loader: ({ deps }) => ({
		queue: Promise.all([
			getReviewPage({ data: deps }),
			getReviewSpecies(),
		]).then(([page, species]) => ({ page, species })),
	}),
	component: Review,
});

function Review() {
	const { queue } = Route.useLoaderData();
	const settled = useSettled(queue);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const router = useRouter();
	const correct = useServerFn(confirmReviewDetection),
		recategorize = useServerFn(recategorizeReviewDetection),
		remove = useServerFn(deleteReviewDetection);
	const change = useMutation({
		mutationFn: async (work: () => Promise<unknown>) => {
			await work();
			await router.invalidate();
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
				promise={queue}
				shell={<ReviewWorkflowSkeleton />}
			>
				{(loaded) => (
					<ReviewWorkflow
						key={loaded.page.page}
						page={loaded.page}
						species={loaded.species}
						busy={change.isPending || !settled?.current}
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

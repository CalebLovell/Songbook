import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	SpeciesFilterPage,
	SpeciesFilterPageSkeleton,
} from "~/components/species-filter/species-filter-page.tsx";
import { pageHead } from "~/lib/link-preview.ts";
import { FORM_QUERY } from "~/lib/query-client.ts";
import { requireUnlocked } from "~/lib/require-unlocked.ts";
import {
	getSpeciesFilterPage,
	saveSpeciesFilter,
} from "~/lib/species-filter.ts";
import { speciesFilterWorkspaceSearchSchema } from "~/lib/species-filter-workspace.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";

const speciesFilterQuery = queryOptions({
	...FORM_QUERY,
	queryKey: ["species-filter"],
	queryFn: () => getSpeciesFilterPage(),
});

export const Route = createFileRoute("/species-filter")({
	head: () => pageHead("Species Filter"),
	validateSearch: speciesFilterWorkspaceSearchSchema,
	beforeLoad: ({ context, location }) =>
		requireUnlocked(context.auth, location),
	component: SpeciesFilterRoute,
});

function SpeciesFilterRoute() {
	const page = useSkeletonMinimum(useQuery(speciesFilterQuery).data);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const save = useServerFn(saveSpeciesFilter);
	const queryClient = useQueryClient();

	if (!page) return <SpeciesFilterPageSkeleton search={search} />;

	return (
		<SpeciesFilterPage
			initialData={page}
			search={search}
			onSearchChange={(nextSearch) =>
				navigate({ search: nextSearch, replace: true })
			}
			onSave={(data) => save({ data })}
			onCommitted={() => queryClient.invalidateQueries()}
		/>
	);
}

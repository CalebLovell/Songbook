import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	SpeciesControlPage,
	SpeciesControlPageSkeleton,
} from "~/components/species-control/species-control-page.tsx";
import { pageHead } from "~/lib/link-preview.ts";
import { FORM_QUERY } from "~/lib/query-client.ts";
import { requireUnlocked } from "~/lib/require-unlocked.ts";
import {
	getSpeciesControlPage,
	saveSpeciesControl,
} from "~/lib/species-control.ts";
import { speciesControlWorkspaceSearchSchema } from "~/lib/species-control-workspace.ts";

const speciesControlQuery = queryOptions({
	...FORM_QUERY,
	queryKey: ["species-control"],
	queryFn: () => getSpeciesControlPage(),
});

export const Route = createFileRoute("/species-control")({
	head: () => pageHead("Species Control"),
	validateSearch: speciesControlWorkspaceSearchSchema,
	beforeLoad: ({ context, location }) =>
		requireUnlocked(context.auth, location),
	component: SpeciesControlRoute,
});

function SpeciesControlRoute() {
	const { data: page } = useQuery(speciesControlQuery);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const save = useServerFn(saveSpeciesControl);
	const queryClient = useQueryClient();

	if (!page) return <SpeciesControlPageSkeleton search={search} />;

	return (
		<SpeciesControlPage
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

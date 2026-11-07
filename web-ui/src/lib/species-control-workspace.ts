import { z } from "zod";

import { pageParam, textParam } from "~/lib/search-schema.ts";
import { nextSort, type SortDirection } from "~/lib/table-sort.ts";

export const SPECIES_CONTROL_SORTS = [
	"species",
	"scientific",
	"count",
	"status",
] as const;

export type SpeciesControlSort = (typeof SPECIES_CONTROL_SORTS)[number];

export const speciesControlWorkspaceSearchSchema = z.object({
	page: pageParam,
	sort: z.enum(SPECIES_CONTROL_SORTS).default("species").catch("species"),
	direction: z.enum(["asc", "desc"]).default("asc").catch("asc"),
	query: textParam,
});

export type SpeciesControlWorkspaceSearch = z.output<
	typeof speciesControlWorkspaceSearchSchema
>;

export const SPECIES_CONTROL_DEFAULT_DIRECTION: Record<
	SpeciesControlSort,
	SortDirection
> = {
	species: "asc",
	scientific: "asc",
	count: "desc",
	status: "asc",
};

export function nextSpeciesControlSort(
	search: SpeciesControlWorkspaceSearch,
	sort: SpeciesControlSort,
): SpeciesControlWorkspaceSearch {
	return nextSort(search, sort, SPECIES_CONTROL_DEFAULT_DIRECTION);
}

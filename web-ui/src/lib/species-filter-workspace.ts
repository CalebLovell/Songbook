import { z } from "zod";

import { pageParam, textParam } from "~/lib/search-schema.ts";
import { nextSort, type SortDirection } from "~/lib/table-sort.ts";

export const SPECIES_FILTER_SORTS = [
	"species",
	"scientific",
	"count",
	"status",
] as const;

export type SpeciesFilterSort = (typeof SPECIES_FILTER_SORTS)[number];

export const speciesFilterWorkspaceSearchSchema = z.object({
	page: pageParam,
	sort: z.enum(SPECIES_FILTER_SORTS).default("species").catch("species"),
	direction: z.enum(["asc", "desc"]).default("asc").catch("asc"),
	query: textParam,
});

export type SpeciesFilterWorkspaceSearch = z.output<
	typeof speciesFilterWorkspaceSearchSchema
>;

export const SPECIES_FILTER_DEFAULT_DIRECTION: Record<
	SpeciesFilterSort,
	SortDirection
> = {
	species: "asc",
	scientific: "asc",
	count: "desc",
	status: "asc",
};

export function nextSpeciesFilterSort(
	search: SpeciesFilterWorkspaceSearch,
	sort: SpeciesFilterSort,
): SpeciesFilterWorkspaceSearch {
	return nextSort(search, sort, SPECIES_FILTER_DEFAULT_DIRECTION);
}

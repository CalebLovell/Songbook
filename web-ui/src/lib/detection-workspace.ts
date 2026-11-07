import { z } from "zod";

import { dayParam, pageParam, textParam } from "~/lib/search-schema.ts";
import { nextSort, type SortDirection } from "~/lib/table-sort.ts";

export const DETECTION_SORTS = [
	"recorded",
	"species",
	"scientific",
	"confidence",
] as const;

export type DetectionWorkspaceSort = (typeof DETECTION_SORTS)[number];

export const DETECTIONS_PAGE_SIZE = 100;

export const detectionWorkspaceSearchSchema = z.object({
	page: pageParam,
	sort: z.enum(DETECTION_SORTS).default("recorded").catch("recorded"),
	direction: z.enum(["asc", "desc"]).default("desc").catch("desc"),
	species: textParam,
	from: dayParam,
	to: dayParam,
});

export type DetectionWorkspaceSearch = z.output<
	typeof detectionWorkspaceSearchSchema
>;

export const DETECTION_DEFAULT_DIRECTION: Record<
	DetectionWorkspaceSort,
	SortDirection
> = {
	recorded: "desc",
	species: "asc",
	scientific: "asc",
	confidence: "desc",
};

export function nextDetectionSort(
	search: DetectionWorkspaceSearch,
	sort: DetectionWorkspaceSort,
): DetectionWorkspaceSearch {
	return nextSort(search, sort, DETECTION_DEFAULT_DIRECTION);
}

export function hasActiveFilters(search: DetectionWorkspaceSearch): boolean {
	return (
		search.species !== undefined ||
		search.from !== undefined ||
		search.to !== undefined
	);
}

export function detectionRowKey(row: { rowId: number }): string {
	return String(row.rowId);
}

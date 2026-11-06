const PAGE_SIZES = [25, 50, 100] as const;

export const DETECTION_SORTS = [
	"recorded",
	"species",
	"scientific",
	"confidence",
] as const;

export type DetectionWorkspaceSort = (typeof DETECTION_SORTS)[number];
export type SortDirection = "asc" | "desc";

export type DetectionWorkspaceSearch = {
	page: number;
	pageSize: (typeof PAGE_SIZES)[number];
	sort: DetectionWorkspaceSort;
	direction: SortDirection;
	species?: string;
	minConfidence?: number;
	from?: string;
	to?: string;
};

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
	return {
		...search,
		page: 1,
		sort,
		direction:
			search.sort === sort
				? search.direction === "asc"
					? "desc"
					: "asc"
				: DETECTION_DEFAULT_DIRECTION[sort],
	};
}

function isIsoDate(value: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function normalizeDetectionWorkspaceSearch(
	input: Record<string, unknown>,
): DetectionWorkspaceSearch {
	const page =
		typeof input.page === "number" && input.page > 0
			? Math.floor(input.page)
			: 1;
	const pageSize = PAGE_SIZES.includes(input.pageSize as 25 | 50 | 100)
		? (input.pageSize as 25 | 50 | 100)
		: 100;
	const sort = DETECTION_SORTS.includes(input.sort as DetectionWorkspaceSort)
		? (input.sort as DetectionWorkspaceSort)
		: "recorded";
	const direction = input.direction === "asc" ? "asc" : "desc";
	const rawSpecies =
		typeof input.species === "number"
			? String(input.species)
			: typeof input.species === "string"
				? input.species
				: "";
	const species = rawSpecies.trim() ? rawSpecies.trim() : undefined;
	const minConfidence =
		typeof input.minConfidence === "number" &&
		input.minConfidence >= 0 &&
		input.minConfidence <= 1
			? input.minConfidence
			: undefined;
	const from =
		typeof input.from === "string" && isIsoDate(input.from)
			? input.from
			: undefined;
	const to =
		typeof input.to === "string" && isIsoDate(input.to) ? input.to : undefined;

	return {
		page,
		pageSize,
		sort,
		direction,
		...(species ? { species } : {}),
		...(minConfidence === undefined ? {} : { minConfidence }),
		...(from ? { from } : {}),
		...(to ? { to } : {}),
	};
}

export function hasActiveFilters(search: DetectionWorkspaceSearch): boolean {
	return (
		search.species !== undefined ||
		search.from !== undefined ||
		search.to !== undefined ||
		search.minConfidence !== undefined
	);
}

export function detectionRowKey(row: { rowId: number }): string {
	return String(row.rowId);
}

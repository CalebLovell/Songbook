export type SortDirection = "asc" | "desc";

export function nextSort<
	Sort extends string,
	Search extends { page: number; sort: Sort; direction: SortDirection },
>(search: Search, sort: Sort, defaults: Record<Sort, SortDirection>): Search {
	const flipped = search.direction === "asc" ? "desc" : "asc";
	return {
		...search,
		page: 1,
		sort,
		direction: search.sort === sort ? flipped : defaults[sort],
	};
}

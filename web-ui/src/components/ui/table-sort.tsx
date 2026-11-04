import {
	ArrowDown,
	ArrowDownWideNarrow,
	ArrowUp,
	ArrowUpNarrowWide,
	ChevronDown,
} from "lucide-react";

type SortDirection = "asc" | "desc";

export function SortMenu<Sort extends string>({
	label,
	sorts,
	labels,
	sort,
	direction,
	reversed,
	onSort,
	onFlip,
}: {
	label: string;
	sorts: readonly Sort[];
	labels: Record<Sort, string>;
	sort: Sort;
	direction: SortDirection;
	reversed: boolean;
	onSort: (sort: Sort) => void;
	onFlip: () => void;
}) {
	const DirectionIcon = reversed ? ArrowUpNarrowWide : ArrowDownWideNarrow;
	return (
		<div className="ml-auto flex h-7 w-fit overflow-hidden rounded-md border border-input bg-card font-normal pointer-coarse:text-base text-sm">
			<div className="relative flex">
				<select
					aria-label={label}
					value={sort}
					onChange={(event) =>
						sort !== event.target.value && onSort(event.target.value as Sort)
					}
					className="h-full cursor-pointer appearance-none bg-transparent pr-7 pl-2.5 leading-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none"
				>
					{sorts.map((option) => (
						<option key={option} value={option}>
							{labels[option]}
						</option>
					))}
				</select>
				<ChevronDown
					className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
			</div>
			<button
				type="button"
				aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}
				aria-pressed={reversed}
				title={direction === "asc" ? "Ascending" : "Descending"}
				onClick={onFlip}
				className="flex w-7 shrink-0 items-center justify-center border-input border-l text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground"
			>
				<DirectionIcon className="size-3.5" aria-hidden="true" />
			</button>
		</div>
	);
}

export function SortButton<Sort extends string>({
	label,
	sort,
	activeSort,
	direction,
	onSort,
}: {
	label: string;
	sort: Sort;
	activeSort: Sort;
	direction: SortDirection;
	onSort: (sort: Sort) => void;
}) {
	const isActive = activeSort === sort;
	const Icon = isActive && direction === "asc" ? ArrowUp : ArrowDown;
	return (
		<button
			type="button"
			className="inline-flex items-center gap-1 hover:text-foreground"
			onClick={() => onSort(sort)}
		>
			{label}
			<Icon className={isActive ? "size-3.5" : "size-3.5 opacity-35"} />
		</button>
	);
}

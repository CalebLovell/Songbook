import {
	ArrowDown,
	ArrowDownWideNarrow,
	ArrowUp,
	ArrowUpNarrowWide,
	ChevronDown,
} from "lucide-react";

import { JOINED_CONTROL_CLASS } from "~/components/ui/joined-control.ts";
import type { SortDirection } from "~/lib/table-sort.ts";
import { cn } from "~/lib/utils.ts";

// A table's own @container is 30px narrower than the toolbar above it (card padding
// and border), so this matches the table's 36rem switch to column headings.
export const TOOLBAR_SORT_CLASS = "@min-[37.875rem]:hidden";

export function SortMenu<Sort extends string>({
	label,
	sorts,
	labels,
	sort,
	direction,
	reversed,
	onSort,
	onFlip,
	className,
}: {
	label: string;
	sorts: readonly Sort[];
	labels: Record<Sort, string>;
	sort: Sort;
	direction: SortDirection;
	reversed: boolean;
	onSort: (sort: Sort) => void;
	onFlip: () => void;
	className?: string;
}) {
	const DirectionIcon = reversed ? ArrowUpNarrowWide : ArrowDownWideNarrow;
	return (
		<div
			className={cn(
				JOINED_CONTROL_CLASS,
				"h-8.5 pointer-coarse:h-9 w-fit shrink-0",
				className,
			)}
		>
			<div className="relative flex">
				<select
					aria-label={label}
					value={sort}
					onChange={(event) =>
						sort !== event.target.value && onSort(event.target.value as Sort)
					}
					className="h-full cursor-pointer appearance-none bg-transparent pr-7 pl-2.5 font-medium pointer-coarse:text-base text-sm leading-none transition-colors hover:bg-accent hover:text-accent-foreground"
				>
					{sorts.map((option) => (
						<option key={option} value={option}>
							{labels[option]}
						</option>
					))}
				</select>
				<ChevronDown
					className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden="true"
				/>
			</div>
			<button
				type="button"
				aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}
				aria-pressed={reversed}
				title={direction === "asc" ? "Ascending" : "Descending"}
				onClick={onFlip}
				className="flex pointer-coarse:w-9 w-8.5 shrink-0 items-center justify-center border-input border-l hover:bg-accent hover:text-accent-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground"
			>
				<DirectionIcon className="size-4" aria-hidden="true" />
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

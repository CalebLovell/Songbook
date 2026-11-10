import { Link } from "@tanstack/react-router";
import {
	type ChangeEvent,
	type CSSProperties,
	type ReactNode,
	useId,
} from "react";
import { IndexDot, TABLE_INDEX_FLOOR } from "~/components/index-dot.tsx";
import { Badge } from "~/components/ui/badge.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import {
	PAGE_RANGE_CLASS,
	PAGE_RANGE_NARROW_HIDDEN,
	PAGE_RANGE_YIELDS_TO_ACTIONS,
	PageRange,
	PageStepper,
	PageStepperShell,
} from "~/components/ui/page-stepper.tsx";
import { RowCheckbox } from "~/components/ui/row-checkbox.tsx";
import { RowWell } from "~/components/ui/row-well.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { SkipLink } from "~/components/ui/skip-link.tsx";
import {
	SELECT_COLUMN_WIDTH,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table.tsx";
import { SortButton, SortMenu } from "~/components/ui/table-sort.tsx";
import { useShiftClickRange } from "~/lib/shift-click-range.ts";
import type {
	SpeciesFilterRow,
	SpeciesStatus,
} from "~/lib/species-filter-data.ts";
import {
	SPECIES_FILTER_DEFAULT_DIRECTION,
	SPECIES_FILTER_SORTS,
	type SpeciesFilterSort,
} from "~/lib/species-filter-workspace.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import type { SortDirection } from "~/lib/table-sort.ts";
import { useAnnounceChange } from "~/lib/use-announce-change.ts";
import { cn } from "~/lib/utils.ts";

export type SpeciesFilterViewRow = SpeciesFilterRow & {
	status: SpeciesStatus;
};

export type SpeciesSortKey = SpeciesFilterSort;

export const SPECIES_FILTER_PAGE_SIZE = 100;

const STATUS_RANK: Record<SpeciesStatus, number> = {
	automatic: 0,
	custom: 1,
	always: 2,
	never: 3,
};

export function sortSpeciesFilterRows(
	rows: SpeciesFilterViewRow[],
	sort: SpeciesSortKey,
	direction: SortDirection,
): SpeciesFilterViewRow[] {
	const multiplier = direction === "asc" ? 1 : -1;
	return [...rows].sort((left, right) => {
		if (sort === "count") {
			return (
				multiplier *
				(left.history.detections - right.history.detections ||
					left.comName.localeCompare(right.comName))
			);
		}
		if (sort === "status") {
			return (
				multiplier *
				(STATUS_RANK[left.status] - STATUS_RANK[right.status] ||
					left.comName.localeCompare(right.comName))
			);
		}
		const comparison =
			sort === "scientific"
				? left.sciName.localeCompare(right.sciName)
				: left.comName.localeCompare(right.comName);
		return multiplier * comparison;
	});
}

const FIRST_COLUMN_CLASSES = "pl-page";
const CELL_GAP = "px-cell";
const NAME_CELL = "min-w-0 @max-xl:py-1.5";
const STATUS_EDGE = "pr-page-end";
const COLUMN_VISIBILITY: Record<string, string> = {
	scientific: "hidden @min-[54rem]:block",
	count: "hidden @xl:block",
};
const GRID_ROW = "col-span-full grid grid-cols-subgrid items-center";
const BODY_ROW_HEIGHT = "min-h-[calc(1.75rem+1rem+1px)]";
const STATUS_CHIP =
	"border-0 px-2.5 py-1.5 font-semibold leading-none ring-1 ring-current/20 ring-inset";
const COLUMN_GRID = {
	"--cols-xs": "max-content max-content minmax(max-content, 1fr) max-content",
	"--cols-sm": "max-content max-content minmax(0, 1fr) max-content",
	"--cols-md":
		"max-content max-content minmax(0, 1fr) minmax(max-content, 1fr) max-content",
	"--cols-lg":
		"max-content max-content repeat(3, minmax(max-content, 1fr)) max-content",
} as CSSProperties;

const SORT_LABELS: Record<SpeciesSortKey, string> = {
	species: "Species",
	scientific: "Scientific name",
	count: "Count",
	status: "Status",
};

const STATUS_PRESENTATION: Record<
	SpeciesStatus,
	{ label: string; className: string }
> = {
	automatic: {
		label: "Automatic",
		className:
			"bg-[color-mix(in_oklab,var(--muted-foreground)_16%,var(--paper-raised))] text-muted-foreground",
	},
	custom: {
		label: "Custom",
		className:
			"bg-[color-mix(in_oklab,var(--moss)_16%,var(--paper-raised))] text-moss",
	},
	always: {
		label: "Always detect",
		className:
			"bg-[color-mix(in_oklab,var(--sand)_32%,var(--paper-raised))] text-bark",
	},
	never: {
		label: "Never detect",
		className:
			"bg-[color-mix(in_oklab,var(--clay)_20%,var(--paper-raised))] text-destructive",
	},
};

export function SpeciesFilterTable({
	rows,
	page,
	pageCount,
	selected,
	sort,
	direction,
	onSortChange,
	onSelectedChange,
	onPageChange,
	actions,
}: {
	rows: SpeciesFilterViewRow[] | null;
	page: number;
	pageCount: number;
	selected: Set<string>;
	sort: SpeciesSortKey;
	direction: SortDirection;
	onSortChange: (key: SpeciesSortKey) => void;
	onSelectedChange: (next: Set<string>) => void;
	onPageChange: (page: number) => void;
	actions?: ReactNode;
}) {
	const allSelected = rows?.every((row) => selected.has(row.sciName));
	const firstIndex = (page - 1) * SPECIES_FILTER_PAGE_SIZE + 1;
	const lastIndex = firstIndex + (rows?.length ?? SPECIES_FILTER_PAGE_SIZE) - 1;

	const rowsForClick = useShiftClickRange(selected.size > 0);
	const actionsId = useId();
	useAnnounceChange(
		selected.size > 0
			? `${selected.size} selected. Press Enter to reach the actions.`
			: "Nothing selected",
	);

	function toggle(sciName: string, event: ChangeEvent<HTMLInputElement>) {
		const { checked } = event.target;
		const orderedIds = (rows ?? []).map((row) => row.sciName);
		const next = new Set(selected);
		for (const id of rowsForClick(orderedIds, sciName, event)) {
			checked ? next.add(id) : next.delete(id);
		}
		onSelectedChange(next);
	}

	function sortHeading(key: SpeciesSortKey, className?: string) {
		const active = sort === key;
		return (
			<TableHead
				role="columnheader"
				aria-sort={
					active ? (direction === "asc" ? "ascending" : "descending") : "none"
				}
				className={cn(
					"font-semibold",
					CELL_GAP,
					COLUMN_VISIBILITY[key] ?? "@xl:block hidden",
					className,
				)}
			>
				<SortButton
					label={SORT_LABELS[key]}
					sort={key}
					activeSort={sort}
					direction={direction}
					onSort={onSortChange}
				/>
			</TableHead>
		);
	}

	return (
		<div className="@container relative flex min-h-0 flex-1 flex-col">
			<SkipLink targetId={actionsId} className="absolute top-1 left-0">
				Skip to table actions
			</SkipLink>
			<Table
				role="table"
				aria-label="Installed species"
				className="grid h-full min-w-min @min-[54rem]:grid-cols-(--cols-lg) @xl:grid-cols-(--cols-md) grid-cols-(--cols-sm) grid-rows-[auto_minmax(0,1fr)] max-[400px]:min-w-0 max-[400px]:grid-cols-[minmax(0,1fr)]"
				style={COLUMN_GRID}
				containerClassName="-ml-page -mr-card-edge -mt-page min-h-0 flex-1 overflow-x-auto overflow-y-hidden pr-0 pl-0"
			>
				<TableHeader
					role="rowgroup"
					className="@xl:scrollbar-gutter-stable col-span-full grid grid-cols-subgrid overflow-hidden border-b bg-surface-strong max-[400px]:grid-cols-[max-content_minmax(0,1fr)] [&_th]:h-auto [&_th]:py-0 [&_th]:leading-none [&_th_button]:leading-none [&_tr]:h-11 [&_tr]:border-none"
				>
					<TableRow role="row" className={GRID_ROW}>
						<TableHead
							role="columnheader"
							className={cn(
								SELECT_COLUMN_WIDTH,
								"w-[calc(var(--page-gap)+var(--row-checkbox-size)+var(--cell-gap))] min-w-[calc(var(--page-gap)+var(--row-checkbox-size)+var(--cell-gap))] font-semibold",
								CELL_GAP,
								FIRST_COLUMN_CLASSES,
							)}
						>
							<RowCheckbox
								aria-label="Select all species on this page"
								actionsId={actionsId}
								checked={allSelected}
								onChange={(event) => {
									const next = new Set(selected);
									for (const row of rows ?? [])
										event.target.checked
											? next.add(row.sciName)
											: next.delete(row.sciName);
									onSelectedChange(next);
								}}
							/>
						</TableHead>
						<TableHead
							role="columnheader"
							className={cn(
								"@xl:block hidden text-center font-semibold",
								CELL_GAP,
							)}
						>
							<StatusTip />
							<span className="sr-only">Row</span>
						</TableHead>
						{sortHeading("species")}
						{sortHeading("scientific")}
						{sortHeading("count", "text-right")}
						{sortHeading(
							"status",
							cn(STATUS_EDGE, "text-right @xl:w-36 @xl:min-w-36"),
						)}
						<TableHead
							role="columnheader"
							className="col-[2/-1] @xl:hidden pr-page"
						>
							<div className="flex items-center gap-2">
								<StatusTip />
								<SortMenu
									label="Sort species by"
									sorts={SPECIES_FILTER_SORTS}
									labels={SORT_LABELS}
									sort={sort}
									direction={direction}
									reversed={
										direction !== SPECIES_FILTER_DEFAULT_DIRECTION[sort]
									}
									onSort={onSortChange}
									onFlip={() => onSortChange(sort)}
								/>
							</div>
						</TableHead>
					</TableRow>
				</TableHeader>
				<RowWell
					as={TableBody}
					role="rowgroup"
					aria-busy={rows === null || undefined}
					data-scroll-reset=""
					className="scrollbar-gutter-stable col-span-full grid min-h-0 grid-cols-subgrid content-start overflow-y-auto max-[400px]:grid-cols-(--cols-xs) max-[400px]:overflow-x-auto"
				>
					{rows === null
						? Array.from({ length: SPECIES_FILTER_PAGE_SIZE }, (_, index) => (
								<SkeletonRow
									// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
									key={index}
									index={index}
									widestIndex={Math.max(lastIndex, TABLE_INDEX_FLOOR)}
								/>
							))
						: null}
					{(rows ?? []).map((row, index) => {
						const isSelected = selected.has(row.sciName);
						const presentation = STATUS_PRESENTATION[row.status];
						return (
							<TableRow
								key={row.sciName}
								role="row"
								data-state={isSelected && "selected"}
								className={cn(
									GRID_ROW,
									BODY_ROW_HEIGHT,
									isSelected ? "bg-row-selected" : "bg-card",
								)}
							>
								<TableCell
									role="cell"
									className={cn(CELL_GAP, FIRST_COLUMN_CLASSES)}
								>
									<RowCheckbox
										aria-label={`Select ${row.comName}`}
										checked={isSelected}
										onChange={(event) => toggle(row.sciName, event)}
									/>
								</TableCell>
								<TableCell role="cell" className={cn(CELL_GAP, "text-center")}>
									<IndexDot
										index={firstIndex + index}
										widest={Math.max(lastIndex, TABLE_INDEX_FLOOR)}
									/>
								</TableCell>
								<TableCell
									role="cell"
									className={cn(CELL_GAP, NAME_CELL, "truncate")}
								>
									<Link
										to="/birds/$comName"
										preload={false}
										params={{ comName: comNameToSlug(row.comName) }}
										className="@max-xl:block @max-xl:truncate font-medium @max-xl:leading-tight no-underline hover:underline"
									>
										{row.comName}
									</Link>
									<em className="block @xl:hidden truncate text-bark text-xs leading-tight">
										{row.sciName}
									</em>
								</TableCell>
								<TableCell
									role="cell"
									className={cn(CELL_GAP, COLUMN_VISIBILITY.scientific)}
								>
									<em className="text-bark">{row.sciName}</em>
								</TableCell>
								<TableCell
									role="cell"
									className={cn(
										CELL_GAP,
										COLUMN_VISIBILITY.count,
										"text-right tabular-nums",
										!row.history.detections && "text-muted-foreground",
									)}
								>
									{row.history.detections.toLocaleString()}
								</TableCell>
								<TableCell
									role="cell"
									className={cn(CELL_GAP, STATUS_EDGE, "text-right")}
								>
									<Badge
										variant="ghost"
										className={cn(STATUS_CHIP, presentation.className)}
									>
										{presentation.label}
									</Badge>
								</TableCell>
							</TableRow>
						);
					})}
				</RowWell>
			</Table>

			<div
				className="-mr-card-edge -ml-page flex min-h-11.25 shrink-0 items-center gap-page border-t py-1.5 pr-card-edge pl-page text-sm outline-none focus-visible:outline-none"
				id={actionsId}
				tabIndex={-1}
			>
				{rows === null ? (
					<div
						aria-hidden="true"
						className={`${PAGE_RANGE_CLASS} ${PAGE_RANGE_NARROW_HIDDEN}`}
					>
						<ShellText className="w-40" barClassName="w-full" />
					</div>
				) : (
					<PageRange
						first={firstIndex}
						last={lastIndex}
						className={actions ? PAGE_RANGE_YIELDS_TO_ACTIONS : undefined}
					/>
				)}
				{actions}
				{rows === null ? (
					<PageStepperShell
						variant="ghost"
						label="Species pages"
						page={page}
						pageCount={pageCount}
					/>
				) : (
					<PageStepper
						className="ml-auto"
						variant="ghost"
						label="Species pages"
						page={page}
						pageCount={pageCount}
						onPageChange={onPageChange}
					/>
				)}
			</div>
		</div>
	);
}

function StatusTip() {
	return (
		<InfoTip label="Species statuses">
			<ul className="space-y-1">
				<li>
					<strong>Automatic:</strong> uses BirdNET's usual species rules.
				</li>
				<li>
					<strong>Custom:</strong> adds the species to your custom list.
				</li>
				<li>
					<strong>Always detect:</strong> skips its species-frequency check.
				</li>
				<li>
					<strong>Never detect:</strong> excludes it outright.
				</li>
			</ul>
		</InfoTip>
	);
}

const NAME_WIDTHS = ["w-36", "w-28", "w-40", "w-32", "w-24"];
const SCIENTIFIC_WIDTHS = ["w-40", "w-32", "w-44", "w-36", "w-28"];

function SkeletonRow({
	index,
	widestIndex,
}: {
	index: number;
	widestIndex: number;
}) {
	return (
		<TableRow
			role="row"
			aria-hidden="true"
			className={cn(GRID_ROW, BODY_ROW_HEIGHT, "bg-card")}
		>
			<TableCell role="cell" className={cn(CELL_GAP, FIRST_COLUMN_CLASSES)}>
				<ShellBar className="size-row-checkbox rounded-sm" />
			</TableCell>
			<TableCell role="cell" className={cn(CELL_GAP, "text-center")}>
				<ShellSized className="rounded-full">
					<IndexDot index={widestIndex} widest={widestIndex} />
				</ShellSized>
			</TableCell>
			<TableCell role="cell" className={cn(CELL_GAP, NAME_CELL)}>
				<ShellText
					className="font-medium @max-xl:leading-tight"
					barClassName={NAME_WIDTHS[index % NAME_WIDTHS.length]}
				/>
				<ShellText
					className="@xl:hidden text-xs leading-tight"
					barClassName={SCIENTIFIC_WIDTHS[index % SCIENTIFIC_WIDTHS.length]}
				/>
			</TableCell>
			<TableCell
				role="cell"
				className={cn(CELL_GAP, COLUMN_VISIBILITY.scientific)}
			>
				<ShellText
					barClassName={SCIENTIFIC_WIDTHS[index % SCIENTIFIC_WIDTHS.length]}
				/>
			</TableCell>
			<TableCell
				role="cell"
				className={cn(CELL_GAP, COLUMN_VISIBILITY.count, "text-right")}
			>
				<ShellText barClassName="right-0 left-auto w-10" />
			</TableCell>
			<TableCell
				role="cell"
				className={cn(CELL_GAP, STATUS_EDGE, "text-right")}
			>
				<ShellSized className="rounded-full">
					<Badge variant="ghost" className={STATUS_CHIP}>
						Automatic
					</Badge>
				</ShellSized>
			</TableCell>
		</TableRow>
	);
}

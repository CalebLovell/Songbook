import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { IndexDot, TABLE_INDEX_FLOOR } from "~/components/index-dot.tsx";
import { Badge } from "~/components/ui/badge.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import {
	PAGE_RANGE_CLASS,
	PAGE_RANGE_NARROW_HIDDEN,
	PAGE_ROW_CLASS,
	PageRange,
	PageStepper,
} from "~/components/ui/page-stepper.tsx";
import { RowCheckbox } from "~/components/ui/row-checkbox.tsx";
import { RowWell } from "~/components/ui/row-well.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
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
import type {
	SpeciesControlRow,
	SpeciesStatus,
} from "~/lib/species-control-data.ts";
import {
	SPECIES_CONTROL_DEFAULT_DIRECTION,
	SPECIES_CONTROL_SORTS,
	type SpeciesControlSort,
	type SpeciesControlSortDirection,
} from "~/lib/species-control-workspace.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { cn } from "~/lib/utils.ts";

export type SpeciesControlViewRow = SpeciesControlRow & {
	status: SpeciesStatus;
};

export type SpeciesSortKey = SpeciesControlSort;

export const SPECIES_CONTROL_PAGE_SIZE = 50;

const STATUS_RANK: Record<SpeciesStatus, number> = {
	automatic: 0,
	custom: 1,
	always: 2,
	never: 3,
};

export function sortSpeciesControlRows(
	rows: SpeciesControlViewRow[],
	sort: SpeciesSortKey,
	direction: SpeciesControlSortDirection,
): SpeciesControlViewRow[] {
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
const STATUS_EDGE = "pr-page-end";
const COLUMN_VISIBILITY: Record<string, string> = {
	scientific: "hidden @min-[54rem]:block",
	count: "hidden @min-[36rem]:block",
};
const GRID_ROW = "col-span-full grid grid-cols-subgrid items-center";
const BODY_ROW_HEIGHT = "min-h-[calc(1.75rem+1rem+1px)]";
const STATUS_CHIP = "border-0 px-2.5 py-1.5 font-semibold leading-none";
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
		className: "bg-muted text-muted-foreground",
	},
	custom: {
		label: "Custom",
		className:
			"bg-[color-mix(in_oklab,var(--sage)_35%,var(--paper-raised))] text-moss",
	},
	always: {
		label: "Always detect",
		className:
			"bg-[color-mix(in_oklab,var(--sand)_30%,var(--paper-raised))] text-bark",
	},
	never: {
		label: "Never detect",
		className:
			"bg-[color-mix(in_oklab,var(--clay)_15%,var(--paper-raised))] text-destructive",
	},
};

export function SpeciesControlTable({
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
	rows: SpeciesControlViewRow[] | null;
	page: number;
	pageCount: number;
	selected: Set<string>;
	sort: SpeciesSortKey;
	direction: SpeciesControlSortDirection;
	onSortChange: (key: SpeciesSortKey) => void;
	onSelectedChange: (next: Set<string>) => void;
	onPageChange: (page: number) => void;
	actions?: ReactNode;
}) {
	const allSelected = rows?.every((row) => selected.has(row.sciName));
	const firstIndex = (page - 1) * SPECIES_CONTROL_PAGE_SIZE + 1;
	const lastIndex =
		firstIndex + (rows?.length ?? SPECIES_CONTROL_PAGE_SIZE) - 1;

	function toggle(sciName: string, checked: boolean) {
		const next = new Set(selected);
		checked ? next.add(sciName) : next.delete(sciName);
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
					COLUMN_VISIBILITY[key] ?? "@min-[36rem]:block hidden",
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
		<div className="@container flex min-h-0 flex-1 flex-col">
			<Table
				role="table"
				className="grid h-full min-w-min @min-[36rem]:grid-cols-(--cols-md) @min-[54rem]:grid-cols-(--cols-lg) grid-cols-(--cols-sm) grid-rows-[auto_minmax(0,1fr)] max-[400px]:grid-cols-(--cols-xs)"
				style={COLUMN_GRID}
				containerClassName="-ml-page -mr-card-edge -mt-page min-h-0 flex-1 overflow-x-auto overflow-y-hidden pr-0 pl-0"
			>
				<TableHeader
					role="rowgroup"
					className="col-span-full grid grid-cols-subgrid overflow-hidden border-b bg-surface-strong @min-[36rem]:[scrollbar-gutter:stable] [&_th]:h-auto [&_th]:py-0 [&_th]:leading-none [&_th_button]:leading-none [&_tr]:h-11 [&_tr]:border-none"
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
								"@min-[36rem]:block hidden text-center font-semibold",
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
							cn(
								STATUS_EDGE,
								"text-right @min-[36rem]:w-36 @min-[36rem]:min-w-36",
							),
						)}
						<TableHead
							role="columnheader"
							className="col-[2/-1] @min-[36rem]:hidden pr-page"
						>
							<div className="flex items-center gap-2">
								<StatusTip />
								<SortMenu
									label="Sort species by"
									sorts={SPECIES_CONTROL_SORTS}
									labels={SORT_LABELS}
									sort={sort}
									direction={direction}
									reversed={
										direction !== SPECIES_CONTROL_DEFAULT_DIRECTION[sort]
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
					className="col-span-full grid min-h-0 grid-cols-subgrid content-start overflow-y-auto [scrollbar-gutter:stable]"
				>
					{rows === null
						? Array.from({ length: SPECIES_CONTROL_PAGE_SIZE }, (_, index) => (
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
										onChange={(event) =>
											toggle(row.sciName, event.target.checked)
										}
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
									className={cn(CELL_GAP, "min-w-0 truncate")}
								>
									<Link
										to="/birds/$comName"
										params={{ comName: comNameToSlug(row.comName) }}
										className="font-medium no-underline hover:underline"
									>
										{row.comName}
									</Link>
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

			<div className="-mr-card-edge -ml-page flex min-h-[calc(2.75rem+1px)] shrink-0 flex-wrap items-center gap-page border-t py-1.5 pr-card-edge pl-page text-sm">
				{actions}
				<div className={PAGE_ROW_CLASS}>
					{rows === null ? (
						<div
							aria-hidden="true"
							className={`${PAGE_RANGE_CLASS} ${PAGE_RANGE_NARROW_HIDDEN}`}
						>
							<ShellText className="w-40" barClassName="w-full" />
						</div>
					) : (
						<PageRange first={firstIndex} last={lastIndex} />
					)}
					{rows === null ? (
						<span className="ml-auto">
							<ShellSized className="rounded-md">
								<PageStepper
									variant="ghost"
									label="Species pages"
									page={page}
									pageCount={pageCount}
									onPageChange={() => {}}
								/>
							</ShellSized>
						</span>
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
			<TableCell role="cell" className={cn(CELL_GAP, "min-w-0")}>
				<ShellText
					className="font-medium"
					barClassName={NAME_WIDTHS[index % NAME_WIDTHS.length]}
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

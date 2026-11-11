import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	type OnChangeFn,
	type RowSelectionState,
	rowSelectionFeature,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { ArrowRight, Calendar, Trash2, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { IndexDot, TABLE_INDEX_FLOOR } from "~/components/index-dot.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { JOINED_CONTROL_CLASS } from "~/components/ui/joined-control.ts";
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
import { DebouncedSearchInput } from "~/components/ui/search-input.tsx";
import { SelectionBar } from "~/components/ui/selection-bar.tsx";
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
import {
	SortButton,
	SortMenu,
	TOOLBAR_SORT_CLASS,
} from "~/components/ui/table-sort.tsx";
import { audioUrlFor } from "~/lib/audio.ts";
import { formatDate, formatDateTime, formatTime } from "~/lib/date-format.ts";
import {
	DETECTION_DEFAULT_DIRECTION,
	DETECTION_SORTS,
	DETECTIONS_PAGE_SIZE,
	type DetectionWorkspaceSearch,
	type DetectionWorkspaceSort,
	detectionRowKey,
	nextDetectionSort,
} from "~/lib/detection-workspace.ts";
import type { DetectionPage, DetectionTableRow } from "~/lib/detections.ts";
import { plural } from "~/lib/number-format.ts";
import { useShiftClickRange } from "~/lib/shift-click-range.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { useAnnounceChange } from "~/lib/use-announce-change.ts";
import { cn } from "~/lib/utils.ts";

const TABLE_FEATURES = tableFeatures({ rowSelectionFeature });

type DetectionColumn = ColumnDef<typeof TABLE_FEATURES, DetectionTableRow>;

type DetectionsTableProps = {
	page: DetectionPage | null;
	search: DetectionWorkspaceSearch;
	onSearchChange: (search: DetectionWorkspaceSearch) => void;
	rowSelection: RowSelectionState;
	onRowSelectionChange: OnChangeFn<RowSelectionState>;
	canDelete: boolean;
	canListen: boolean;
	onDeleteSelected: () => void;
};

type DetectionsFiltersProps = Pick<
	DetectionsTableProps,
	"search" | "onSearchChange"
>;

const FIRST_COLUMN_CLASSES = "pl-page";
const CELL_GAP = "px-cell";
const AUDIO_EDGE = "pr-page-end";
const LAST_EDGE_WITHOUT_AUDIO: Record<string, string> = {
	recorded: `${AUDIO_EDGE} @xl:pr-cell`,
	confidence: AUDIO_EDGE,
};
const COLUMN_VISIBILITY: Record<string, string> = {
	scientificName: "hidden @min-[54rem]:block",
	confidence: "hidden @xl:block",
};
const HEADER_CLASSES: Record<string, string> = {
	select: `${SELECT_COLUMN_WIDTH} w-[calc(var(--page-gap)+var(--row-checkbox-size)+var(--cell-gap))] min-w-[calc(var(--page-gap)+var(--row-checkbox-size)+var(--cell-gap))]`,
	index: "text-center",
	confidence: "text-right",
	audio: `${AUDIO_EDGE} text-right @xl:w-32 @xl:min-w-32`,
};
const CELL_CLASSES: Record<string, string> = {
	index: "text-center",
	species: "min-w-0 truncate",
	recorded: "text-right @xl:text-left",
	audio: AUDIO_EDGE,
};

const GRID_ROW = "col-span-full grid grid-cols-subgrid items-center";

function gridColumns(canDelete: boolean, canListen: boolean): CSSProperties {
	const lead = canDelete ? "max-content max-content " : "max-content ";
	const audio = canListen ? " max-content" : "";
	const fill = "minmax(max-content, 1fr)";
	return {
		"--cols-sm": `${lead}minmax(0, 1fr) max-content${audio}`,
		"--cols-md": `${lead}minmax(0, 1fr) ${fill} ${fill}${audio}`,
		"--cols-lg": `${lead}repeat(4, ${fill})${audio}`,
	} as CSSProperties;
}

const LISTEN_LABEL = "hidden @xl:inline";
const LISTEN_SQUARE = "@max-xl:w-7 @max-xl:px-0";

const SORT_LABELS: Record<DetectionWorkspaceSort, string> = {
	recorded: "Recorded",
	species: "Species",
	scientific: "Scientific name",
	confidence: "Confidence",
};

function DateRangeFilter({
	from,
	to,
	onChange,
}: {
	from: string | undefined;
	to: string | undefined;
	onChange: (range: {
		from: string | undefined;
		to: string | undefined;
	}) => void;
}) {
	return (
		<fieldset
			aria-label="Date range"
			className={cn(
				JOINED_CONTROL_CLASS,
				"h-8.5 pointer-coarse:h-9 @min-[38rem]:w-auto w-full shrink-0 focus-within:border-focus-ring",
			)}
		>
			<DateSegment
				label="From date"
				value={from}
				max={to}
				onChange={(value) => onChange({ from: value, to })}
			/>
			<span
				aria-hidden="true"
				className="flex items-center border-input border-x px-2 text-muted-foreground max-[400px]:px-1"
			>
				<ArrowRight className="size-4" />
			</span>
			<DateSegment
				label="To date"
				value={to}
				min={from}
				onChange={(value) => onChange({ from, to: value })}
			/>
			<button
				type="button"
				aria-label="Clear date range"
				title="Clear dates"
				disabled={!from && !to}
				onClick={() => onChange({ from: undefined, to: undefined })}
				className="flex pointer-coarse:w-9 w-8.5 shrink-0 items-center justify-center border-input border-l text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
			>
				<X className="size-4" aria-hidden="true" />
			</button>
		</fieldset>
	);
}

function DateSegment({
	label,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	value: string | undefined;
	min?: string;
	max?: string;
	onChange: (value: string | undefined) => void;
}) {
	return (
		<div className="relative flex min-w-0 @min-[38rem]:flex-none flex-1 items-center @min-[38rem]:justify-start justify-center gap-2 @min-[38rem]:px-3 px-2 pointer-coarse:text-base text-sm transition-colors hover:bg-accent max-[400px]:px-1">
			<Calendar
				className="size-4 shrink-0 text-muted-foreground max-[400px]:hidden"
				aria-hidden="true"
			/>
			<span
				className={`@min-[38rem]:min-w-26 truncate whitespace-nowrap max-[400px]:text-sm ${value ? "" : "text-muted-foreground"}`}
			>
				{value ? formatDate(value) : "Any date"}
			</span>
			<input
				aria-label={label}
				className="absolute inset-0 size-full cursor-pointer text-base opacity-0"
				type="date"
				value={value ?? ""}
				min={min}
				max={max}
				onClick={(event) => {
					try {
						event.currentTarget.showPicker?.();
					} catch {}
				}}
				onChange={(event) => onChange(event.target.value || undefined)}
			/>
		</div>
	);
}

function renderInPlace<Context>(
	template: ReactNode | ((context: Context) => ReactNode),
	context: Context,
) {
	return typeof template === "function" ? template(context) : template;
}

const SORT_BY_COLUMN: Partial<Record<string, DetectionWorkspaceSort>> = {
	species: "species",
	scientificName: "scientific",
	recorded: "recorded",
	confidence: "confidence",
};

function ariaSortFor(
	columnId: string,
	search: { sort: DetectionWorkspaceSort; direction: "asc" | "desc" },
) {
	const sort = SORT_BY_COLUMN[columnId];
	if (!sort) return undefined;
	if (sort !== search.sort) return "none";
	return search.direction === "asc" ? "ascending" : "descending";
}

function DetectionSelectionBar({
	count,
	onClear,
	onDelete,
}: {
	count: number;
	onClear: () => void;
	onDelete: () => void;
}) {
	return (
		<SelectionBar
			label="Selected detections"
			count={count}
			onClear={onClear}
			className="shrink-0"
		>
			<button
				type="button"
				aria-label={`Delete ${count} selected ${plural(count, "detection")}`}
				onClick={onDelete}
				className="flex @xl:w-auto pointer-coarse:w-9 w-8 items-center justify-center gap-2 border-input border-l @xl:px-3 text-destructive hover:bg-destructive/10"
			>
				<Trash2 className="size-4" aria-hidden="true" />
				<span className="sr-only @xl:not-sr-only">Delete</span>
			</button>
		</SelectionBar>
	);
}

export function DetectionsFilters({
	search,
	onSearchChange,
}: DetectionsFiltersProps) {
	function updateSearch(change: Partial<DetectionWorkspaceSearch>) {
		onSearchChange({ ...search, ...change });
	}

	return (
		<div className="@container">
			<div className="flex @min-[38rem]:flex-row flex-col @min-[38rem]:items-center @min-[38rem]:justify-between gap-page">
				<div className="flex w-full min-w-0 flex-1 items-center gap-page">
					<DebouncedSearchInput
						aria-label="Search detections"
						placeholder="Search…"
						value={search.species ?? ""}
						onCommit={(value) =>
							updateSearch({ page: 1, species: value || undefined })
						}
					/>
					<SortMenu
						label="Sort detections by"
						sorts={DETECTION_SORTS}
						labels={SORT_LABELS}
						sort={search.sort}
						direction={search.direction}
						reversed={
							search.direction !== DETECTION_DEFAULT_DIRECTION[search.sort]
						}
						onSort={(sort) => updateSearch(nextDetectionSort(search, sort))}
						onFlip={() =>
							updateSearch({
								page: 1,
								direction: search.direction === "asc" ? "desc" : "asc",
							})
						}
						className={TOOLBAR_SORT_CLASS}
					/>
				</div>
				<div className="@max-[38rem]:order-first @min-[38rem]:w-auto w-full">
					<DateRangeFilter
						from={search.from}
						to={search.to}
						onChange={({ from, to }) => updateSearch({ page: 1, from, to })}
					/>
				</div>
			</div>
		</div>
	);
}

const SKELETON_ROWS = Array.from(
	{ length: DETECTIONS_PAGE_SIZE },
	() => ({}) as DetectionTableRow,
);

const SPECIES_WIDTHS = ["w-36", "w-28", "w-40", "w-32", "w-24"];
const SCIENTIFIC_WIDTHS = ["w-40", "w-32", "w-44", "w-36", "w-28"];

function SkeletonCell({
	columnId,
	row,
	widestIndex,
}: {
	columnId: string;
	row: number;
	widestIndex: number;
}) {
	switch (columnId) {
		case "select":
			return <ShellBar className="size-row-checkbox rounded-sm" />;
		case "index":
			return (
				<ShellSized className="rounded-full">
					<IndexDot index={widestIndex} widest={widestIndex} />
				</ShellSized>
			);
		case "species":
			return (
				<>
					<ShellText
						className="font-medium @max-xl:leading-tight"
						barClassName={SPECIES_WIDTHS[row % SPECIES_WIDTHS.length]}
					/>
					<ShellText
						className="@xl:hidden text-xs leading-tight"
						barClassName={SCIENTIFIC_WIDTHS[row % SCIENTIFIC_WIDTHS.length]}
					/>
				</>
			);
		case "scientificName":
			return (
				<ShellText
					barClassName={SCIENTIFIC_WIDTHS[row % SCIENTIFIC_WIDTHS.length]}
				/>
			);
		case "recorded":
			return (
				<>
					<span className="flex @xl:hidden flex-col items-end">
						<ShellText
							className="w-14 text-sm leading-tight"
							barClassName="right-0 left-auto w-full"
						/>
						<ShellText
							className="w-16 text-xs leading-tight"
							barClassName="right-0 left-auto w-full"
						/>
					</span>
					<ShellText className="@xl:block hidden text-sm" barClassName="w-40" />
				</>
			);
		case "confidence":
			return (
				<div className="flex justify-end">
					<ShellSized className="rounded-full">
						<ConfidencePill confidence={0.9} />
					</ShellSized>
				</div>
			);
		case "audio":
			return (
				<div className="flex justify-end">
					<ShellSized className="rounded-md">
						<RecordingButton
							audioUrl={null}
							size="sm"
							labelClassName={LISTEN_LABEL}
							className={LISTEN_SQUARE}
						/>
					</ShellSized>
				</div>
			);
		default:
			return null;
	}
}

export function DetectionsTable({
	page,
	search,
	onSearchChange,
	rowSelection,
	onRowSelectionChange,
	canDelete,
	canListen,
	onDeleteSelected,
}: DetectionsTableProps) {
	const selectedCount = Object.values(rowSelection).filter(Boolean).length;
	const actionsId = useId();
	const selectAllId = useId();
	const rowsForClick = useShiftClickRange(selectedCount > 0);

	function updateSearch(change: Partial<DetectionWorkspaceSearch>) {
		onSearchChange({ ...search, ...change });
		onRowSelectionChange({});
	}

	function sortBy(sort: DetectionWorkspaceSort) {
		updateSearch(nextDetectionSort(search, sort));
	}

	const selectColumn: DetectionColumn = {
		id: "select",
		header: ({ table }) => (
			<RowCheckbox
				id={selectAllId}
				aria-label="Select all detections on this page"
				actionsId={actionsId}
				checked={table.getIsAllPageRowsSelected()}
				onChange={table.getToggleAllPageRowsSelectedHandler()}
			/>
		),
		cell: ({ row, table }) => (
			<RowCheckbox
				aria-label={`Select ${row.original.Com_Name}`}
				actionsId={actionsId}
				checked={row.getIsSelected()}
				onChange={(event) => {
					const { checked } = event.target;
					const orderedIds = table.getRowModel().rows.map(({ id }) => id);
					const ids = rowsForClick(orderedIds, row.id, event);
					onRowSelectionChange((current) => {
						const next = { ...current };
						for (const id of ids) {
							if (checked) next[id] = true;
							else delete next[id];
						}
						return next;
					});
				}}
			/>
		),
	};

	const firstIndex = (search.page - 1) * DETECTIONS_PAGE_SIZE + 1;
	const lastIndex =
		firstIndex + (page?.rows.length ?? DETECTIONS_PAGE_SIZE) - 1;
	const indexColumn: DetectionColumn = {
		id: "index",
		header: () => (
			<>
				<span aria-hidden="true">#</span>
				<span className="sr-only">Row</span>
			</>
		),
		cell: ({ row }) => (
			<IndexDot
				index={firstIndex + row.index}
				widest={Math.max(lastIndex, TABLE_INDEX_FLOOR)}
			/>
		),
	};

	const audioColumn: DetectionColumn = {
		id: "audio",
		header: () => <span className="sr-only @xl:not-sr-only">Recording</span>,
		cell: ({ row }) => (
			<div className="flex justify-end">
				<RecordingButton
					audioUrl={audioUrlFor(
						row.original.Date,
						row.original.Com_Name,
						row.original.File_Name,
					)}
					size="sm"
					labelClassName={LISTEN_LABEL}
					className={LISTEN_SQUARE}
					speciesName={row.original.Com_Name}
				/>
			</div>
		),
	};

	const columns: DetectionColumn[] = [
		...(canDelete ? [selectColumn] : []),
		indexColumn,
		{
			accessorKey: "Com_Name",
			id: "species",
			header: () => (
				<SortButton
					label="Species"
					sort="species"
					activeSort={search.sort}
					direction={search.direction}
					onSort={sortBy}
				/>
			),
			cell: ({ row }) => (
				<>
					<Link
						to="/birds/$comName"
						preload={false}
						params={{ comName: comNameToSlug(row.original.Com_Name) }}
						className="@max-xl:block @max-xl:truncate font-medium @max-xl:leading-tight no-underline hover:underline"
					>
						{row.original.Com_Name}
					</Link>
					<em className="block @xl:hidden truncate text-bark text-xs leading-tight">
						{row.original.Sci_Name}
					</em>
				</>
			),
		},
		{
			accessorKey: "Sci_Name",
			id: "scientificName",
			header: () => (
				<SortButton
					label="Scientific name"
					sort="scientific"
					activeSort={search.sort}
					direction={search.direction}
					onSort={sortBy}
				/>
			),
			cell: ({ row }) => <em className="text-bark">{row.original.Sci_Name}</em>,
		},
		{
			id: "recorded",
			header: () => (
				<SortButton
					label="Recorded"
					sort="recorded"
					activeSort={search.sort}
					direction={search.direction}
					onSort={sortBy}
				/>
			),
			cell: ({ row }) => (
				<Link
					to="/timeline"
					preload={false}
					search={{ period: "day", date: row.original.Date }}
					className="text-sm tabular-nums no-underline hover:underline"
				>
					<span className="flex @xl:hidden flex-col items-end">
						<span className="leading-tight">
							{formatTime(row.original.Time)}
						</span>
						<span className="text-muted-foreground text-xs leading-tight">
							{formatDate(row.original.Date)}
						</span>
					</span>
					<span className="@xl:inline hidden">
						{formatDateTime(row.original.Date, row.original.Time)}
					</span>
				</Link>
			),
		},
		{
			accessorKey: "Confidence",
			id: "confidence",
			header: () => (
				<div className="text-right">
					<SortButton
						label="Confidence"
						sort="confidence"
						activeSort={search.sort}
						direction={search.direction}
						onSort={sortBy}
					/>
				</div>
			),
			cell: ({ row }) => (
				<div className="flex justify-end">
					{row.original.Confidence === null ? (
						<span className="text-bark tabular-nums">—</span>
					) : (
						<ConfidencePill confidence={row.original.Confidence} />
					)}
				</div>
			),
		},
		...(canListen ? [audioColumn] : []),
	];

	const skeleton = page === null;
	const table = useTable({
		features: TABLE_FEATURES,
		columns: skeleton
			? columns.map(
					(column) =>
						({
							...column,
							cell: ({ row }: { row: { index: number } }) => (
								<SkeletonCell
									columnId={column.id ?? ""}
									row={row.index}
									widestIndex={Math.max(lastIndex, TABLE_INDEX_FLOOR)}
								/>
							),
						}) as DetectionColumn,
				)
			: columns,
		data: page?.rows ?? SKELETON_ROWS,
		getRowId: skeleton ? (_, index) => `skeleton-${index}` : detectionRowKey,
		enableRowSelection: true,
		onRowSelectionChange,
		state: { rowSelection },
	});

	const loadedPageCount = page
		? Math.max(1, Math.ceil(page.total / DETECTIONS_PAGE_SIZE))
		: null;
	const [lastPageCount, setLastPageCount] = useState(loadedPageCount);
	if (loadedPageCount !== null && loadedPageCount !== lastPageCount) {
		setLastPageCount(loadedPageCount);
	}
	const pageCount = loadedPageCount ?? lastPageCount;
	const selectionShown = canDelete && selectedCount > 0;
	useAnnounceChange(
		selectedCount > 0
			? `${selectedCount} selected. Press Enter to reach the actions.`
			: "Nothing selected",
	);
	useAnnounceChange(
		page
			? `${page.total.toLocaleString()} ${plural(page.total, "detection")}`
			: null,
	);
	return (
		<div className="@container relative flex min-h-0 flex-1 flex-col">
			<SkipLink targetId={actionsId} className="absolute top-1 left-0">
				Skip to table actions
			</SkipLink>
			<Table
				role="table"
				aria-label="Detections"
				className={cn(
					"grid h-full min-w-min @min-[54rem]:grid-cols-(--cols-lg) @xl:grid-cols-(--cols-md) grid-cols-(--cols-sm) grid-rows-[auto_minmax(0,1fr)]",
					!canDelete && "@max-xl:grid-rows-[minmax(0,1fr)]",
				)}
				style={gridColumns(canDelete, canListen)}
				containerClassName="-ml-page -mr-card-edge -mt-page min-h-0 flex-1 overflow-x-auto overflow-y-hidden pr-0 pl-0"
			>
				<TableHeader
					role="rowgroup"
					className={cn(
						"scrollbar-gutter-stable col-span-full grid grid-cols-subgrid overflow-hidden border-b bg-surface-strong [&_th]:h-auto [&_th]:py-0 [&_th]:leading-none [&_th_button]:leading-none [&_tr]:h-11 [&_tr]:border-none",
						!canDelete && "@max-xl:hidden",
					)}
				>
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow key={headerGroup.id} role="row" className={GRID_ROW}>
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									role="columnheader"
									aria-sort={ariaSortFor(header.column.id, search)}
									className={cn(
										"font-semibold",
										CELL_GAP,
										HEADER_CLASSES[header.column.id],
										!canListen && LAST_EDGE_WITHOUT_AUDIO[header.column.id],
										header.column.id === "select"
											? undefined
											: (COLUMN_VISIBILITY[header.column.id] ??
													"@xl:block hidden"),
										header.index === 0 && FIRST_COLUMN_CLASSES,
									)}
								>
									{header.isPlaceholder
										? null
										: renderInPlace(
												header.column.columnDef.header,
												header.getContext(),
											)}
								</TableHead>
							))}
							{canDelete ? (
								<TableHead
									role="columnheader"
									className={cn(
										"col-[2/-1] flex @xl:hidden items-center justify-between gap-page font-normal",
										CELL_GAP,
										AUDIO_EDGE,
									)}
								>
									<label
										htmlFor={selectAllId}
										className="cursor-pointer text-muted-foreground"
									>
										Select all
									</label>
									{page ? (
										<span className="text-muted-foreground tabular-nums">
											{page.total.toLocaleString()}{" "}
											{plural(page.total, "detection")}
										</span>
									) : null}
								</TableHead>
							) : null}
						</TableRow>
					))}
				</TableHeader>
				<RowWell
					as={TableBody}
					role="rowgroup"
					aria-busy={skeleton || undefined}
					data-scroll-reset=""
					className="scrollbar-gutter-stable col-span-full grid min-h-0 auto-rows-max grid-cols-subgrid content-start overflow-y-auto"
				>
					{table.getRowModel().rows.map((row) => (
						<TableRow
							key={row.id}
							role="row"
							data-state={row.getIsSelected() && "selected"}
							className={cn(
								GRID_ROW,
								"h-auto min-h-10.25",
								row.getIsSelected() ? "bg-row-selected" : "bg-card",
							)}
						>
							{row.getAllCells().map((cell, index) => (
								<TableCell
									key={cell.id}
									role="cell"
									className={cn(
										CELL_GAP,
										"@max-xl:py-2.5",
										CELL_CLASSES[cell.column.id],
										!canListen && LAST_EDGE_WITHOUT_AUDIO[cell.column.id],
										COLUMN_VISIBILITY[cell.column.id],
										index === 0 && FIRST_COLUMN_CLASSES,
									)}
								>
									{renderInPlace(cell.column.columnDef.cell, cell.getContext())}
								</TableCell>
							))}
						</TableRow>
					))}
				</RowWell>
			</Table>

			<div
				className="-mr-card-edge -ml-page flex min-h-11.25 shrink-0 items-center gap-page border-t py-1.5 pr-card-edge pl-page text-sm outline-none focus-visible:outline-none"
				id={actionsId}
				tabIndex={-1}
			>
				{page ? (
					<PageRange
						first={firstIndex}
						last={lastIndex}
						className={
							selectionShown ? PAGE_RANGE_YIELDS_TO_ACTIONS : undefined
						}
					/>
				) : (
					<div
						aria-hidden="true"
						className={`${PAGE_RANGE_CLASS} ${PAGE_RANGE_NARROW_HIDDEN}`}
					>
						<ShellText className="w-44" barClassName="w-full" />
					</div>
				)}
				{selectionShown ? (
					<DetectionSelectionBar
						count={selectedCount}
						onClear={() => onRowSelectionChange({})}
						onDelete={onDeleteSelected}
					/>
				) : null}
				{pageCount === null ? (
					<PageStepperShell
						variant="ghost"
						label="Detections pages"
						page={search.page}
						pageCount={1000}
					/>
				) : (
					<PageStepper
						className="ml-auto"
						variant="ghost"
						label="Detections pages"
						page={search.page}
						pageCount={pageCount}
						onPageChange={(page) => updateSearch({ page })}
					/>
				)}
			</div>
		</div>
	);
}

import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	getCoreRowModel,
	type OnChangeFn,
	type RowSelectionState,
	useReactTable,
} from "@tanstack/react-table";
import { ArrowRight, Calendar, Trash2, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useId } from "react";
import { useDebouncedCallback } from "use-debounce";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { IndexDot, TABLE_INDEX_FLOOR } from "~/components/index-dot.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import {
	PAGE_RANGE_CLASS,
	PAGE_RANGE_NARROW_HIDDEN,
	PAGE_RANGE_YIELDS_TO_ACTIONS,
	PageRange,
	PageStepper,
} from "~/components/ui/page-stepper.tsx";
import { RowCheckbox } from "~/components/ui/row-checkbox.tsx";
import { RowWell } from "~/components/ui/row-well.tsx";
import { SearchInput } from "~/components/ui/search-input.tsx";
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
import { audioUrlFor } from "~/lib/audio.ts";
import { formatDate, formatDateTime } from "~/lib/date-format.ts";
import {
	DETECTION_DEFAULT_DIRECTION,
	DETECTION_SORTS,
	type DetectionWorkspaceSearch,
	type DetectionWorkspaceSort,
	detectionRowKey,
	nextDetectionSort,
} from "~/lib/detection-workspace.ts";
import type { DetectionPage, DetectionTableRow } from "~/lib/detections.ts";
import { useShiftClickRange } from "~/lib/shift-click-range.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";
import { useAnnounceChange } from "~/lib/use-announce-change.ts";
import { useDraft } from "~/lib/use-draft.ts";
import { cn } from "~/lib/utils.ts";

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
		"--cols-xs": `${lead}${fill} max-content${audio}`,
		"--cols-sm": `${lead}minmax(0, 1fr) max-content${audio}`,
		"--cols-md": `${lead}minmax(0, 1fr) ${fill} ${fill}${audio}`,
		"--cols-lg": `${lead}repeat(4, ${fill})${audio}`,
	} as CSSProperties;
}

function recordedLabel(row: DetectionTableRow): string {
	return formatDateTime(row.Date, row.Time);
}

function clockLabel(row: DetectionTableRow): string {
	return formatDateTime(row.Date, row.Time).split(", ").at(-1) ?? row.Time;
}

function dayLabel(row: DetectionTableRow): string {
	return formatDate(row.Date);
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
			className="flex h-8.5 pointer-coarse:h-9 @min-[38rem]:w-auto w-full shrink-0 overflow-hidden rounded-md border border-control-line bg-card focus-within:border-focus-ring"
		>
			<DateSegment
				label="From date"
				value={from}
				max={to}
				showIcon
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
				showIcon
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
	showIcon = false,
	onChange,
}: {
	label: string;
	value: string | undefined;
	min?: string;
	max?: string;
	showIcon?: boolean;
	onChange: (value: string | undefined) => void;
}) {
	return (
		<div className="relative flex min-w-0 @min-[38rem]:flex-none flex-1 items-center @min-[38rem]:justify-start justify-center gap-2 @min-[38rem]:px-3 px-2 pointer-coarse:text-base text-sm transition-colors hover:bg-accent max-[400px]:px-1">
			{showIcon ? (
				<Calendar
					className="size-4 shrink-0 text-muted-foreground max-[400px]:hidden"
					aria-hidden="true"
				/>
			) : null}
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

function SelectionBar({
	count,
	onClear,
	onDelete,
}: {
	count: number;
	onClear: () => void;
	onDelete: () => void;
}) {
	const noun = count === 1 ? "detection" : "detections";
	return (
		<fieldset
			aria-label="Selected detections"
			className="flex h-8 pointer-coarse:h-9 w-fit shrink-0 overflow-hidden rounded-md border border-input bg-card text-sm *:focus-visible:-outline-offset-2"
		>
			<span className="flex items-center gap-[0.5ch] @xl:px-3 px-2 text-muted-foreground">
				<span className="font-semibold text-foreground tabular-nums">
					{count}
				</span>
				<span className="sr-only @xl:not-sr-only">selected</span>
			</span>
			<button
				type="button"
				aria-label="Clear selection"
				title="Clear selection"
				onClick={onClear}
				className="flex pointer-coarse:w-9 w-8 shrink-0 items-center justify-center border-input border-l text-muted-foreground hover:bg-accent hover:text-accent-foreground"
			>
				<X className="size-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				aria-label={`Delete ${count} selected ${noun}`}
				onClick={onDelete}
				className="flex @xl:w-auto pointer-coarse:w-9 w-8 items-center justify-center gap-2 border-input border-l @xl:px-3 text-destructive hover:bg-destructive/10"
			>
				<Trash2 className="size-4" aria-hidden="true" />
				<span className="sr-only @xl:not-sr-only">Delete</span>
			</button>
		</fieldset>
	);
}

export function DetectionsFilters({
	search,
	onSearchChange,
}: DetectionsFiltersProps) {
	function updateSearch(change: Partial<DetectionWorkspaceSearch>) {
		onSearchChange({ ...search, ...change });
	}

	const [queryInput, setQueryInput] = useDraft(search.species ?? "");

	const debouncedSetQuery = useDebouncedCallback((value: string) => {
		updateSearch({ page: 1, species: value || undefined });
	}, 200);

	return (
		<div className="@container">
			<div className="flex @min-[38rem]:flex-row flex-col @min-[38rem]:items-center @min-[38rem]:justify-between gap-page">
				<SearchInput
					aria-label="Search detections"
					placeholder="Search detections..."
					value={queryInput}
					onChange={(event) => {
						const value = event.target.value;
						setQueryInput(value);
						debouncedSetQuery(value);
					}}
					onClear={() => {
						setQueryInput("");
						debouncedSetQuery.cancel();
						updateSearch({ page: 1, species: undefined });
					}}
				/>
				<div className="@min-[38rem]:w-auto w-full">
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
	{ length: 100 },
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
	const rowsForClick = useShiftClickRange(selectedCount > 0);

	function updateSearch(change: Partial<DetectionWorkspaceSearch>) {
		onSearchChange({ ...search, ...change });
		onRowSelectionChange({});
	}

	function flipSort() {
		updateSearch({
			page: 1,
			direction: search.direction === "asc" ? "desc" : "asc",
		});
	}

	function sortBy(sort: DetectionWorkspaceSort) {
		const next = nextDetectionSort(search, sort);
		updateSearch({
			page: next.page,
			sort: next.sort,
			direction: next.direction,
		});
	}

	const selectColumn: ColumnDef<DetectionTableRow> = {
		id: "select",
		header: ({ table }) => (
			<RowCheckbox
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
		enableHiding: false,
	};

	const firstIndex = (search.page - 1) * search.pageSize + 1;
	const lastIndex = firstIndex + (page?.rows.length ?? search.pageSize) - 1;
	const indexColumn: ColumnDef<DetectionTableRow> = {
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
		enableHiding: false,
	};

	const audioColumn: ColumnDef<DetectionTableRow> = {
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
		enableHiding: false,
	};

	const columns: ColumnDef<DetectionTableRow>[] = [
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
					search={{ period: "day", date: row.original.Date }}
					className="text-sm tabular-nums no-underline hover:underline"
				>
					<span className="flex @xl:hidden flex-col items-end">
						<span className="leading-tight">{clockLabel(row.original)}</span>
						<span className="text-muted-foreground text-xs leading-tight">
							{dayLabel(row.original)}
						</span>
					</span>
					<span className="@xl:inline hidden">
						{recordedLabel(row.original)}
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
	const table = useReactTable({
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
						}) as ColumnDef<DetectionTableRow>,
				)
			: columns,
		data: page?.rows ?? SKELETON_ROWS.slice(0, search.pageSize),
		getCoreRowModel: getCoreRowModel(),
		getRowId: skeleton ? (_, index) => `skeleton-${index}` : detectionRowKey,
		manualPagination: true,
		manualSorting: true,
		enableRowSelection: true,
		pageCount: Math.max(1, Math.ceil((page?.total ?? 0) / search.pageSize)),
		onRowSelectionChange,
		state: { rowSelection },
	});

	const pageCount = page
		? Math.max(1, Math.ceil(page.total / search.pageSize))
		: 1000;
	const selectionShown = canDelete && selectedCount > 0;
	useAnnounceChange(
		selectedCount > 0
			? `${selectedCount} selected. Press Enter to reach the actions.`
			: "Nothing selected",
	);
	useAnnounceChange(
		page
			? `${page.total.toLocaleString()} ${page.total === 1 ? "detection" : "detections"}`
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
				className="grid h-full min-w-min @min-[54rem]:grid-cols-(--cols-lg) @xl:grid-cols-(--cols-md) grid-cols-(--cols-sm) grid-rows-[auto_minmax(0,1fr)] max-[400px]:min-w-0 max-[400px]:grid-cols-[minmax(0,1fr)]"
				style={gridColumns(canDelete, canListen)}
				containerClassName="-ml-page -mr-card-edge -mt-page min-h-0 flex-1 overflow-x-auto overflow-y-hidden pr-0 pl-0"
			>
				<TableHeader
					role="rowgroup"
					className="@xl:scrollbar-gutter-stable col-span-full grid grid-cols-subgrid overflow-hidden border-b bg-surface-strong max-[400px]:grid-cols-[max-content_minmax(0,1fr)] [&_th]:h-auto [&_th]:py-0 [&_th]:leading-none [&_th_button]:leading-none [&_tr]:h-11 [&_tr]:border-none"
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
							<TableHead
								role="columnheader"
								className={cn(
									"@xl:hidden",
									canDelete
										? "col-[2/-1]"
										: `col-span-full ${FIRST_COLUMN_CLASSES}`,
									"pr-page",
								)}
							>
								<SortMenu
									label="Sort detections by"
									sorts={DETECTION_SORTS}
									labels={SORT_LABELS}
									sort={search.sort}
									direction={search.direction}
									reversed={
										search.direction !==
										DETECTION_DEFAULT_DIRECTION[search.sort]
									}
									onSort={sortBy}
									onFlip={flipSort}
								/>
							</TableHead>
						</TableRow>
					))}
				</TableHeader>
				<RowWell
					as={TableBody}
					role="rowgroup"
					aria-busy={skeleton || undefined}
					data-scroll-reset=""
					className="scrollbar-gutter-stable col-span-full grid min-h-0 auto-rows-max grid-cols-subgrid content-start overflow-y-auto max-[400px]:grid-cols-(--cols-xs) max-[400px]:overflow-x-auto"
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
							{row.getVisibleCells().map((cell, index) => (
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
					<SelectionBar
						count={selectedCount}
						onClear={() => onRowSelectionChange({})}
						onDelete={onDeleteSelected}
					/>
				) : null}
				{skeleton ? (
					<span className="ml-auto">
						<ShellSized className="rounded-md">
							<PageStepper
								variant="ghost"
								label="Detections pages"
								page={search.page}
								pageCount={pageCount}
								onPageChange={() => {}}
							/>
						</ShellSized>
					</span>
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

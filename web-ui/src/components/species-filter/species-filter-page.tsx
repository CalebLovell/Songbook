import { useMutation } from "@tanstack/react-query";
import {
	Check,
	ChevronDown,
	CircleAlert,
	type LucideIcon,
	RotateCcw,
	SlidersHorizontal,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CardHeader } from "~/components/card-header.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import {
	DebouncedSearchInput,
	SearchInput,
} from "~/components/ui/search-input.tsx";
import { SelectionBar } from "~/components/ui/selection-bar.tsx";
import { destructiveToast, toast } from "~/components/ui/toaster.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import {
	type SpeciesFilterPageData,
	type SpeciesFilterSaveInput,
	type SpeciesStatus,
	speciesFilterInputWithStatus,
	speciesFilterResetInput,
	speciesStatusFor,
} from "~/lib/species-filter-data.ts";
import {
	nextSpeciesFilterSort,
	type SpeciesFilterWorkspaceSearch,
} from "~/lib/species-filter-workspace.ts";
import { speciesFuse } from "~/lib/species-fuse.ts";
import { useAnnounceChange } from "~/lib/use-announce-change.ts";
import { errorMessage } from "~/lib/utils.ts";
import {
	SPECIES_FILTER_PAGE_SIZE,
	SpeciesFilterTable,
	type SpeciesFilterViewRow,
	sortSpeciesFilterRows,
} from "./species-filter-table.tsx";
import { SpeciesFilterTools } from "./species-filter-tools.tsx";

const TOOLBAR_CLASS =
	"flex @min-[38rem]:flex-row flex-col @min-[38rem]:flex-wrap @min-[38rem]:items-center gap-page";
const SEARCH_CLASS = "@min-[38rem]:min-w-64 @min-[38rem]:flex-[1_1_20rem]";
const TABLE_CARD_CLASS =
	"@container flex min-h-80 flex-col overflow-hidden [--card-edge:min(var(--page-gap),0.75rem)]";

export function SpeciesFilterPageSkeleton({
	search,
}: {
	search: SpeciesFilterWorkspaceSearch;
}) {
	return (
		<PageWrap className="flex h-full min-h-fit flex-col gap-page">
			<div className="@container shrink-0 space-y-page">
				<PageHeaderCard
					icon={SlidersHorizontal}
					title={PAGE_HEADERS.speciesFilter.title}
					description={PAGE_HEADERS.speciesFilter.description}
				/>
				<div inert className={TOOLBAR_CLASS}>
					<SearchInput
						aria-label="Search installed species"
						className={SEARCH_CLASS}
						placeholder="Search species..."
						value={search.query ?? ""}
						onChange={() => {}}
						onClear={() => {}}
					/>
					<SpeciesFilterTools
						onImport={() => {}}
						onExport={() => {}}
						onReset={() => {}}
					/>
				</div>
			</div>
			<Card
				as="section"
				aria-busy="true"
				aria-label="Installed species"
				className={`${TABLE_CARD_CLASS} flex-1 pr-card-edge pb-0`}
			>
				<SpeciesFilterTable
					rows={null}
					page={search.page}
					pageCount={130}
					selected={new Set()}
					sort={search.sort}
					direction={search.direction}
					onSortChange={() => {}}
					onSelectedChange={() => {}}
					onPageChange={() => {}}
				/>
			</Card>
		</PageWrap>
	);
}

type PageAdapters = {
	search: SpeciesFilterWorkspaceSearch;
	onSearchChange: (search: SpeciesFilterWorkspaceSearch) => void;
	onSave?: (input: SpeciesFilterSaveInput) => Promise<{ revision: string }>;
	onCommitted?: () => void | Promise<void>;
};

type ProposedDialog =
	| {
			kind: "status";
			input: SpeciesFilterSaveInput;
			label: string;
			count: number;
	  }
	| { kind: "import"; input: SpeciesFilterSaveInput }
	| {
			kind: "remove-unresolved";
			input: SpeciesFilterSaveInput;
			raw: string;
	  }
	| { kind: "reset"; input: SpeciesFilterSaveInput };

type CommitMessages = {
	success: string;
	failure: string;
	destructive?: boolean;
};

function dialogContent(dialog: ProposedDialog): {
	title: string;
	description: string;
	confirmIcon: LucideIcon;
	confirmLabel: string;
	clearSelection: boolean;
	messages: CommitMessages;
} {
	switch (dialog.kind) {
		case "status":
			return {
				title: `Set ${dialog.count} species to ${dialog.label}?`,
				description: "The selected species will use this status immediately.",
				confirmIcon: Check,
				confirmLabel: `Apply ${dialog.label}`,
				clearSelection: true,
				messages: {
					success: `Set ${dialog.count} species to ${dialog.label}.`,
					failure: "Species statuses could not be saved.",
				},
			};
		case "import":
			return {
				title: "Import these species lists?",
				description:
					"The imported statuses will replace the current lists immediately.",
				confirmIcon: Check,
				confirmLabel: "Import lists",
				clearSelection: true,
				messages: {
					success: "Imported the species lists.",
					failure: "Species lists could not be imported.",
				},
			};
		case "remove-unresolved":
			return {
				title: "Remove this unmatched entry?",
				description: `${dialog.raw} will be removed from its species list immediately.`,
				confirmIcon: Trash2,
				confirmLabel: "Remove entry",
				clearSelection: false,
				messages: {
					success: `Removed ${dialog.raw}.`,
					failure: "The unmatched entry could not be removed.",
					destructive: true,
				},
			};
		case "reset":
			return {
				title: "Reset all species lists?",
				description:
					"This immediately clears the Custom, Never detect, and Always detect lists. This action cannot be undone.",
				confirmIcon: RotateCcw,
				confirmLabel: "Reset lists",
				clearSelection: true,
				messages: {
					success: "Cleared all species lists.",
					failure: "Species lists could not be reset.",
					destructive: true,
				},
			};
	}
}

const BULK_STATUS_ACTIONS: Array<{
	status: SpeciesStatus;
	label: string;
	className: string;
}> = [
	{
		status: "automatic",
		label: "Automatic",
		className: "text-muted-foreground hover:bg-muted",
	},
	{
		status: "custom",
		label: "Custom",
		className:
			"text-moss hover:bg-[color-mix(in_oklab,var(--sage)_35%,var(--paper-raised))]",
	},
	{
		status: "always",
		label: "Always detect",
		className:
			"text-bark hover:bg-[color-mix(in_oklab,var(--sand)_30%,var(--paper-raised))]",
	},
	{
		status: "never",
		label: "Never detect",
		className:
			"text-destructive hover:bg-[color-mix(in_oklab,var(--clay)_15%,var(--paper-raised))]",
	},
];

export function SpeciesSelectionBar({
	count,
	onClear,
	onStatus,
}: {
	count: number;
	onClear: () => void;
	onStatus: (status: SpeciesStatus) => void;
}) {
	return (
		<SelectionBar
			label="Set selected species status"
			count={count}
			onClear={onClear}
			className="min-w-0"
		>
			{BULK_STATUS_ACTIONS.map((action) => (
				<button
					key={action.status}
					type="button"
					aria-label={`Set selected species to ${action.label}`}
					onClick={() => onStatus(action.status)}
					className={`flex @max-[50rem]:hidden items-center justify-center whitespace-nowrap border-input border-l px-3 ${action.className}`}
				>
					{action.label}
				</button>
			))}
			<span className="relative flex @min-[50rem]:hidden min-w-0 border-input border-l">
				<select
					aria-label="Status for selected species"
					value=""
					onChange={(event) => onStatus(event.target.value as SpeciesStatus)}
					className="w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-7 pl-2 pointer-coarse:text-base text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none"
				>
					<option value="" disabled hidden>
						Status
					</option>
					{BULK_STATUS_ACTIONS.map((action) => (
						<option key={action.status} value={action.status}>
							{action.label}
						</option>
					))}
				</select>
				<ChevronDown
					aria-hidden="true"
					className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
				/>
			</span>
		</SelectionBar>
	);
}

function setFrom(
	data: SpeciesFilterPageData,
	key: "custom" | "excluded" | "whitelisted",
) {
	return new Set(
		data.rows
			.filter((row) =>
				key === "custom" ? speciesStatusFor(row) === "custom" : row[key],
			)
			.map((row) => row.sciName),
	);
}

export function SpeciesFilterPage({
	initialData,
	search,
	onSearchChange,
	onSave,
	onCommitted,
}: { initialData: SpeciesFilterPageData } & PageAdapters) {
	const [custom, setCustom] = useState(() => setFrom(initialData, "custom"));
	const [excluded, setExcluded] = useState(() =>
		setFrom(initialData, "excluded"),
	);
	const [whitelisted, setWhitelisted] = useState(() =>
		setFrom(initialData, "whitelisted"),
	);
	const [revision, setRevision] = useState(initialData.revision);
	const [selected, setSelected] = useState(new Set<string>());
	const [removedUnresolved, setRemovedUnresolved] = useState(new Set<string>());
	const [dialog, setDialog] = useState<ProposedDialog | null>(null);
	const commitMutation = useMutation({
		mutationFn: ({
			save,
			input,
		}: {
			save: NonNullable<typeof onSave>;
			input: SpeciesFilterSaveInput;
			messages: CommitMessages;
			clearSelection: boolean;
		}) => save(input),
		onSuccess: async (result, { input, messages, clearSelection }) => {
			setRevision(result.revision);
			setCustom(new Set(input.custom));
			setExcluded(new Set(input.excluded));
			setWhitelisted(new Set(input.whitelisted));
			if (input.removeUnresolved.length > 0) {
				setRemovedUnresolved((current) => {
					const next = new Set(current);
					for (const entry of input.removeUnresolved) {
						next.add(`${entry.list}\0${entry.raw}`);
					}
					return next;
				});
			}
			if (clearSelection) setSelected(new Set());
			setDialog(null);
			await onCommitted?.();
			if (messages.destructive) destructiveToast(messages.success);
			else toast.success(messages.success);
		},
		onError: (error, { messages }) => {
			toast.error(errorMessage(error, messages.failure));
			setDialog(null);
		},
	});
	const proposed = dialog ? dialogContent(dialog) : null;

	const viewRows = useMemo<SpeciesFilterViewRow[]>(
		() =>
			initialData.rows.map((row) => {
				const membership = {
					custom: custom.has(row.sciName),
					excluded: excluded.has(row.sciName),
					whitelisted: whitelisted.has(row.sciName),
				};
				return {
					...row,
					...membership,
					status: speciesStatusFor(membership),
				};
			}),
		[custom, excluded, initialData.rows, whitelisted],
	);
	const searched = useMemo(() => {
		if (!search.query) return viewRows;
		return speciesFuse(viewRows)
			.search(search.query)
			.map((result) => result.item);
	}, [search.query, viewRows]);
	const sorted = useMemo(
		() => sortSpeciesFilterRows(searched, search.sort, search.direction),
		[searched, search.sort, search.direction],
	);
	const pageCount = Math.max(
		1,
		Math.ceil(sorted.length / SPECIES_FILTER_PAGE_SIZE),
	);
	const safePage = Math.min(search.page, pageCount);
	useAnnounceChange(`${sorted.length.toLocaleString()} species`);
	const pagedRows = sorted.slice(
		(safePage - 1) * SPECIES_FILTER_PAGE_SIZE,
		safePage * SPECIES_FILTER_PAGE_SIZE,
	);
	useEffect(() => {
		if (search.page !== safePage) {
			onSearchChange({ ...search, page: safePage });
		}
	}, [onSearchChange, safePage, search]);
	const unresolvedCount =
		Object.values(initialData.unresolved).reduce(
			(sum, values) => sum + values.length,
			0,
		) - removedUnresolved.size;

	function currentSaveInput(): SpeciesFilterSaveInput {
		return {
			revision,
			custom: [...custom],
			excluded: [...excluded],
			whitelisted: [...whitelisted],
			removeUnresolved: [],
		};
	}

	function proposeBulkStatus(status: SpeciesStatus) {
		const action = BULK_STATUS_ACTIONS.find((item) => item.status === status);
		if (!action || selected.size === 0) return;
		setDialog({
			kind: "status",
			input: speciesFilterInputWithStatus(
				currentSaveInput(),
				[...selected],
				status,
			),
			label: action.label,
			count: selected.size,
		});
	}

	function importLists(text: string) {
		try {
			const known = new Set(initialData.rows.map((row) => row.sciName));
			const normalizeImported = (value: unknown) => {
				if (typeof value !== "string") return null;
				const trimmed = value.trim();
				if (known.has(trimmed)) return trimmed;
				const separator = trimmed.indexOf("_");
				const scientific = separator > 0 ? trimmed.slice(0, separator) : "";
				return known.has(scientific) ? scientific : null;
			};
			const importedList = (value: unknown, current: Set<string>) =>
				new Set(
					Array.isArray(value)
						? value
								.map(normalizeImported)
								.filter((name): name is string => name !== null)
						: current,
				);
			const parsed = text.trimStart().startsWith("{")
				? (JSON.parse(text) as Record<string, unknown>)
				: { custom: text.split(/\r?\n/) };
			const imported = {
				custom: importedList(parsed.custom, custom),
				excluded: importedList(parsed.excluded, excluded),
				whitelisted: importedList(parsed.whitelisted, whitelisted),
			};
			for (const name of imported.excluded) {
				imported.custom.delete(name);
				imported.whitelisted.delete(name);
			}
			for (const name of imported.whitelisted) imported.custom.delete(name);
			setDialog({
				kind: "import",
				input: {
					revision,
					custom: [...imported.custom],
					excluded: [...imported.excluded],
					whitelisted: [...imported.whitelisted],
					removeUnresolved: [],
				},
			});
		} catch {
			toast.error("That file is not a valid species-list export.");
		}
	}

	function exportLists() {
		const blob = new Blob(
			[
				JSON.stringify(
					{
						custom: [...custom],
						excluded: [...excluded],
						whitelisted: [...whitelisted],
					},
					null,
					2,
				),
			],
			{ type: "application/json" },
		);
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = "birdnet-species-lists.json";
		anchor.click();
		URL.revokeObjectURL(url);
	}

	return (
		<PageWrap className="flex h-full min-h-fit flex-col gap-page">
			<div className="@container shrink-0 space-y-page">
				<PageHeaderCard
					icon={SlidersHorizontal}
					title={PAGE_HEADERS.speciesFilter.title}
					description={PAGE_HEADERS.speciesFilter.description}
				/>

				<div data-layout="species-filter-toolbar" className={TOOLBAR_CLASS}>
					<DebouncedSearchInput
						aria-label="Search installed species"
						className={SEARCH_CLASS}
						placeholder="Search species..."
						value={search.query ?? ""}
						onCommit={(value) =>
							onSearchChange({
								...search,
								page: 1,
								query: value.trim() || undefined,
							})
						}
					/>
					<SpeciesFilterTools
						onImport={importLists}
						onExport={exportLists}
						onReset={() =>
							setDialog({
								kind: "reset",
								input: speciesFilterResetInput(revision),
							})
						}
					/>
				</div>
			</div>

			{pagedRows.length === 0 ? (
				<Card as="section" aria-label="Installed species" className="shrink-0">
					<CardHeader title="Installed species" />
					<EmptyNote>{EMPTY.filter.speciesFilterSearch}</EmptyNote>
				</Card>
			) : (
				<Card
					as="section"
					aria-label="Installed species"
					className={`${TABLE_CARD_CLASS} flex-1 pr-card-edge pb-0`}
				>
					<SpeciesFilterTable
						rows={pagedRows}
						page={safePage}
						pageCount={pageCount}
						selected={selected}
						sort={search.sort}
						direction={search.direction}
						onSortChange={(sort) => {
							setSelected(new Set());
							onSearchChange(nextSpeciesFilterSort(search, sort));
						}}
						onSelectedChange={setSelected}
						onPageChange={(page) => {
							setSelected(new Set());
							onSearchChange({ ...search, page });
						}}
						actions={
							selected.size > 0 ? (
								<SpeciesSelectionBar
									count={selected.size}
									onClear={() => setSelected(new Set())}
									onStatus={proposeBulkStatus}
								/>
							) : null
						}
					/>
				</Card>
			)}

			{unresolvedCount > 0 ? (
				<Card
					as="section"
					aria-label="Unmatched list entries"
					className="flex max-h-64 shrink-0 flex-col"
				>
					<div className="flex shrink-0 items-start gap-3">
						<CircleAlert className="mt-0.5 size-5 text-clay" />
						<div>
							<h2 className="font-semibold">Unmatched list entries</h2>
							<p className="mt-1 text-muted-foreground text-sm">
								These existing lines do not match the installed model. They stay
								in place unless you remove them here.
							</p>
						</div>
					</div>
					<div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
						{(
							Object.entries(initialData.unresolved) as [
								"custom" | "excluded" | "whitelisted",
								string[],
							][]
						).flatMap(([list, values]) =>
							values.map((raw) => {
								const key = `${list}\0${raw}`;
								return removedUnresolved.has(key) ? null : (
									<div
										key={key}
										className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
									>
										<div>
											<Kicker as="span">{list}</Kicker>
											<code className="ml-2">{raw}</code>
										</div>
										<Button
											aria-label={`Remove ${raw}`}
											size="icon-xs"
											variant="ghost"
											onClick={() =>
												setDialog({
													kind: "remove-unresolved",
													raw,
													input: {
														...currentSaveInput(),
														removeUnresolved: [{ list, raw }],
													},
												})
											}
										>
											<X />
										</Button>
									</div>
								);
							}),
						)}
					</div>
				</Card>
			) : null}

			{dialog && proposed ? (
				<ConfirmDialog
					title={proposed.title}
					description={proposed.description}
					confirmIcon={proposed.confirmIcon}
					confirmLabel={proposed.confirmLabel}
					destructive={proposed.messages.destructive}
					pending={commitMutation.isPending}
					onCancel={() => setDialog(null)}
					onConfirm={() => {
						if (!onSave) return;
						commitMutation.mutate({
							save: onSave,
							input: dialog.input,
							messages: proposed.messages,
							clearSelection: proposed.clearSelection,
						});
					}}
				/>
			) : null}
		</PageWrap>
	);
}

import {
	keepPreviousData,
	queryOptions,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { RowSelectionState } from "@tanstack/react-table";
import { AudioWaveform, X } from "lucide-react";
import { useState } from "react";
import { CardHeader } from "~/components/card-header.tsx";
import { Deferred, SHELL_DELAY_MS } from "~/components/deferred.tsx";
import { DeleteDetectionsDialog } from "~/components/detections/delete-detections-dialog.tsx";
import {
	DetectionsFilters,
	DetectionsTable,
} from "~/components/detections/detections-table.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { PageHeaderCard } from "~/components/page-header-card.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { PageWrap } from "~/components/ui/page-wrap.tsx";
import { destructiveToast, toast } from "~/components/ui/toaster.tsx";
import {
	type DetectionWorkspaceSearch,
	detectionWorkspaceSearchSchema,
	hasActiveFilters,
} from "~/lib/detection-workspace.ts";
import { deleteDetections, getDetectionsPage } from "~/lib/detections.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { pageHead } from "~/lib/link-preview.ts";
import { plural } from "~/lib/number-format.ts";
import { PAGE_HEADERS } from "~/lib/page-headers.ts";
import { PAGE_QUERY, prefetchInBrowser } from "~/lib/query-client.ts";

const detectionsQuery = (data: DetectionWorkspaceSearch) =>
	queryOptions({
		...PAGE_QUERY,
		queryKey: ["detections", data],
		queryFn: () => getDetectionsPage({ data }),
	});

export const Route = createFileRoute("/detections")({
	head: () =>
		pageHead(
			"Detections",
			"Every detection this station has logged, searchable, with recordings.",
		),
	validateSearch: detectionWorkspaceSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: ({ context, deps }) => {
		prefetchInBrowser(context.queryClient, detectionsQuery(deps));
	},
	component: Detections,
});

const TABLE_CARD_CLASS =
	"flex min-h-80 flex-col overflow-hidden [--card-edge:min(var(--page-gap),0.75rem)]";

function Detections() {
	const search = Route.useSearch();
	const pageQuery = useQuery({
		...detectionsQuery(search),
		placeholderData: keepPreviousData,
	});
	const page = pageQuery.isPlaceholderData ? null : (pageQuery.data ?? null);
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const { auth } = useRouteContext({ from: "__root__" });
	const canDelete = auth.unlocked;
	const canListen = auth.unlocked;
	const runDeletion = useServerFn(deleteDetections);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
	const [deleteOpen, setDeleteOpen] = useState(false);
	const selectedRowIds = Object.entries(rowSelection)
		.filter(([, isSelected]) => isSelected)
		.map(([rowId]) => Number(rowId));
	const selectedCount = selectedRowIds.length;
	const isFiltered = hasActiveFilters(search);

	const deletion = useMutation({
		mutationFn: (rowIds: number[]) => runDeletion({ data: { rowIds } }),
		onSuccess: async (result) => {
			setDeleteOpen(false);
			setRowSelection({});
			const deleted = `Deleted ${result.deletedRecords} ${plural(result.deletedRecords, "detection")}.`;
			if (result.failedFiles > 0) {
				toast.warning(deleted, {
					description: `${result.failedFiles} audio ${plural(result.failedFiles, "file")} could not be removed.`,
				});
			} else {
				destructiveToast(deleted);
			}

			if (search.page > 1 && selectedCount === page?.rows.length) {
				navigate({
					search: { ...search, page: search.page - 1 },
					replace: true,
				});
			}

			await queryClient.invalidateQueries();
		},
		onError: () => {
			toast.error("Unable to delete the selected detections.", {
				description: "Please try again.",
			});
		},
	});
	const isDeleting = deletion.isPending;
	const confirmDeletion = () => deletion.mutate(selectedRowIds);

	return (
		<PageWrap className="flex h-full min-h-fit flex-col gap-page">
			<div className="shrink-0 space-y-page">
				<PageHeaderCard
					icon={AudioWaveform}
					title={PAGE_HEADERS.detections.title}
					description={PAGE_HEADERS.detections.description}
				/>

				<DetectionsFilters
					search={search}
					onSearchChange={(nextSearch) => {
						setRowSelection({});
						navigate({ search: nextSearch, replace: true });
					}}
				/>
			</div>

			<Deferred
				query={pageQuery}
				shellAfterMs={SHELL_DELAY_MS}
				className="flex min-h-0 flex-1 flex-col"
				shell={
					<DetectionsTableShell
						search={search}
						canDelete={canDelete}
						canListen={canListen}
						onSearchChange={(nextSearch) =>
							navigate({ search: nextSearch, replace: true })
						}
					/>
				}
			>
				{(loaded) =>
					loaded.total === 0 ? (
						<Card
							as="section"
							aria-label="Detection results"
							className="shrink-0"
						>
							<CardHeader title="Detections" />
							<EmptyNote>
								{isFiltered
									? EMPTY.filter.detectionsFilters
									: EMPTY.station.detections}
							</EmptyNote>
							{isFiltered ? (
								<Button
									variant="outline"
									size="sm"
									icon={X}
									className="mt-page"
									onClick={() =>
										navigate({
											search: {
												...search,
												page: 1,
												species: undefined,
												from: undefined,
												to: undefined,
											},
											replace: true,
										})
									}
								>
									Clear filters
								</Button>
							) : null}
						</Card>
					) : (
						<Card
							as="section"
							aria-label="Detection results"
							className={`${TABLE_CARD_CLASS} flex-1 pr-card-edge pb-0`}
						>
							<DetectionsTable
								page={loaded}
								search={search}
								onSearchChange={(nextSearch) =>
									navigate({ search: nextSearch, replace: true })
								}
								rowSelection={rowSelection}
								onRowSelectionChange={setRowSelection}
								canDelete={canDelete}
								canListen={canListen}
								onDeleteSelected={() => setDeleteOpen(true)}
							/>
						</Card>
					)
				}
			</Deferred>

			{deleteOpen ? (
				<DeleteDetectionsDialog
					count={selectedCount}
					pending={isDeleting}
					onCancel={() => setDeleteOpen(false)}
					onConfirm={confirmDeletion}
				/>
			) : null}
		</PageWrap>
	);
}

function DetectionsTableShell({
	search,
	canDelete,
	canListen,
	onSearchChange,
}: {
	search: DetectionWorkspaceSearch;
	canDelete: boolean;
	canListen: boolean;
	onSearchChange: (search: DetectionWorkspaceSearch) => void;
}) {
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label="Detection results"
			className={`${TABLE_CARD_CLASS} flex-1 pr-card-edge pb-0`}
		>
			<DetectionsTable
				page={null}
				search={search}
				onSearchChange={onSearchChange}
				rowSelection={{}}
				onRowSelectionChange={() => {}}
				canDelete={canDelete}
				canListen={canListen}
				onDeleteSelected={() => {}}
			/>
		</Card>
	);
}

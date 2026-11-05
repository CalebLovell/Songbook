import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Check,
	ExternalLink,
	Search,
	ShieldCheck,
	Shuffle,
	Trash2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CardHeader } from "~/components/card-header.tsx";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { IndexDot } from "~/components/index-dot.tsx";
import { SpeciesImage } from "~/components/species-image.tsx";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import {
	ClipMeta,
	ClipMetaSkeleton,
	SpectrogramPlayer,
	SpectrogramPlayerSkeleton,
} from "~/components/spectrogram-player.tsx";
import { Button } from "~/components/ui/button.tsx";
import {
	ConfirmDialog,
	MODAL_ACTIONS_CLASS,
	MODAL_BACKDROP_CLASS,
	MODAL_CARD_CLASS,
	MODAL_TITLE_CLASS,
} from "~/components/ui/confirm-dialog.tsx";
import { Input } from "~/components/ui/input.tsx";
import { PageStepper } from "~/components/ui/page-stepper.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { formatConfidence } from "~/lib/confidence.ts";
import { formatDate, formatDateTime } from "~/lib/date-format.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import type { ReviewCandidate, ReviewPage } from "~/lib/review.server.ts";
import { REVIEW_PAGE_SIZE, type SpeciesOption } from "~/lib/review-data.ts";
import { comNameToSlug } from "~/lib/species-slug.ts";

const ROW_HEIGHT_PX = 54;

const REVIEW_GRID_CLASS =
	"grid grid-cols-[minmax(0,1fr)] @3xl/review:grid-cols-[minmax(0,1fr)_24rem] @7xl/review:grid-cols-[minmax(914px,1fr)_minmax(20rem,38rem)] items-start gap-page";
const REVIEW_PLOT_CLASS = "h-56 max-sm:h-40";
const UNDER_REVIEW_CLASS = "feature-card flex flex-col gap-page rounded-md p-4";
const IDENTITY_ROW_CLASS = "flex items-start gap-page";
const IDENTITY_TEXT_CLASS = "flex min-w-0 flex-1 flex-col items-start";
const NAME_CLASS = "font-bold text-2xl leading-[1.15] sm:text-3xl";
const EBIRD_LINK_CLASS = "mt-1";
const PORTRAIT_CLASS =
	"flex size-20 shrink-0 items-center justify-center overflow-hidden max-[400px]:size-14";
const ACTIONS_FOOTER_CLASS =
	"-mx-page -mb-page flex flex-wrap items-center gap-page border-t px-page py-3";
const DELETE_BUTTON_CLASS =
	"bg-[color-mix(in_oklab,var(--clay)_14%,var(--paper-raised))] text-destructive hover:bg-[color-mix(in_oklab,var(--clay)_22%,var(--paper-raised))] hover:text-destructive";
const QUEUE_CARD_CLASS = "@container feature-card flex flex-col rounded-md p-4";
const QUEUE_HEADER_CLASS =
	"-mx-page -mt-page flex min-h-[45px] items-center justify-between gap-2 border-b px-page";
const QUEUE_ROW_CLASS =
	"flex min-h-[54px] w-full items-center @min-[26rem]:gap-3 gap-2 px-page py-1.75";
const QUEUE_TIME_CLASS = "@min-[26rem]:block hidden shrink-0 text-right";
const QUEUE_FOOTER_CLASS =
	"-mx-page mt-auto -mb-page flex shrink-0 items-center border-t px-page py-2";

const NAME_WIDTHS = ["w-36", "w-28", "w-40", "w-32"];

export function ReviewWorkflowSkeleton() {
	return (
		<div className="@container/review">
			<div className={REVIEW_GRID_CLASS}>
				<section
					aria-busy="true"
					aria-label="Detection under review"
					className={UNDER_REVIEW_CLASS}
				>
					<CardHeader title="Under review" />
					<div aria-hidden="true" className={IDENTITY_ROW_CLASS}>
						<div className={PORTRAIT_CLASS}>
							<ShellBar className="size-full rounded-md" />
						</div>
						<div className={IDENTITY_TEXT_CLASS}>
							<ShellText
								className={`${NAME_CLASS} w-full`}
								barClassName="w-56 max-w-full"
							/>
							<ShellText
								className="w-full text-sm leading-tight"
								barClassName="w-36"
							/>
							<ShellSized className={`${EBIRD_LINK_CLASS} rounded-md`}>
								<Button variant="outline" size="sm">
									<ExternalLink />
									eBird
								</Button>
							</ShellSized>
						</div>
					</div>
					<SpectrogramPlayerSkeleton
						className={REVIEW_PLOT_CLASS}
						aside={<ClipMetaSkeleton />}
					/>
					<div className={ACTIONS_FOOTER_CLASS}>
						<Button
							variant="ghost"
							size="default"
							className={DELETE_BUTTON_CLASS}
							disabled
						>
							<Trash2 />
							Delete
						</Button>
						<div className="ml-auto flex items-center gap-page">
							<Button variant="outline" size="default" disabled>
								<Shuffle />
								Recategorize
							</Button>
							<Button size="default" disabled>
								<ShieldCheck />
								Correct
							</Button>
						</div>
					</div>
				</section>

				<section
					aria-busy="true"
					aria-label="Review queue"
					className={QUEUE_CARD_CLASS}
				>
					<div className={QUEUE_HEADER_CLASS}>
						<div className="island-kicker">In the queue</div>
						<ShellText
							className="count-figure w-[1ch]"
							barClassName="right-0 left-auto w-full"
						/>
					</div>
					<ol aria-hidden="true" className="-mx-page divide-y">
						{Array.from({ length: REVIEW_PAGE_SIZE }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
							<li key={index}>
								<div className={QUEUE_ROW_CLASS}>
									<ShellSized className="rounded-full">
										<IndexDot index={88} widest={88} />
									</ShellSized>
									<div className="flex size-10 shrink-0 items-center justify-center">
										<ShellBar className="size-9 rounded-md" />
									</div>
									<span className="min-w-0 flex-1">
										<ShellText
											className="font-medium"
											barClassName={NAME_WIDTHS[index % NAME_WIDTHS.length]}
										/>
										<ShellText className="text-xs" barClassName="w-24" />
									</span>
									<span className={QUEUE_TIME_CLASS}>
										<ShellText
											className="w-14 text-sm"
											barClassName="right-0 left-auto w-full"
										/>
										<ShellText
											className="w-14 text-xs"
											barClassName="right-0 left-auto w-full"
										/>
									</span>
									<ShellSized className="rounded-full">
										<ConfidencePill confidence={0.5} className="shrink-0" />
									</ShellSized>
								</div>
							</li>
						))}
					</ol>
					<div className={QUEUE_FOOTER_CLASS}>
						<span className="ml-auto">
							<ShellSized className="rounded-md">
								<PageStepper
									variant="ghost"
									label="Review queue pages"
									page={1}
									pageCount={20}
									onPageChange={() => {}}
								/>
							</ShellSized>
						</span>
					</div>
				</section>
			</div>
		</div>
	);
}

function ReviewWorkflowEmpty({
	message,
	total,
	nextPage,
}: {
	message: string;
	total: number;
	nextPage?: () => void;
}) {
	return (
		<div className="@container/review">
			<div className={REVIEW_GRID_CLASS}>
				<section
					aria-label="Detection under review"
					className="feature-card rounded-md p-4"
				>
					<CardHeader title="Under review" />
					<EmptyNote>{message}</EmptyNote>
				</section>

				<section
					aria-label="Review queue"
					className="feature-card rounded-md p-4"
				>
					<CardHeader title="In the queue">
						<span className="count-figure">{total}</span>
					</CardHeader>
					<EmptyNote>{message}</EmptyNote>
					{nextPage ? (
						<div className="mt-3">
							<Button
								variant="outline"
								size="xs"
								icon={ArrowRight}
								iconPosition="end"
								onClick={nextPage}
							>
								Next page
							</Button>
						</div>
					) : null}
				</section>
			</div>
		</div>
	);
}

type Action =
	| { kind: "correct"; row: ReviewCandidate }
	| { kind: "delete"; row: ReviewCandidate }
	| { kind: "recategorize"; row: ReviewCandidate; species: SpeciesOption };

function formatRecorded(date: string, time: string) {
	return {
		day: formatDate(date),
		clock: formatDateTime(date, time).split(", ").at(-1) ?? time,
	};
}

export function ReviewWorkflow({
	page,
	species,
	busy,
	onCorrect,
	onRecategorize,
	onDelete,
	onPageChange,
}: {
	page: ReviewPage;
	species: SpeciesOption[];
	busy: boolean;
	onCorrect: (rowId: number) => Promise<void>;
	onRecategorize: (rowId: number, species: SpeciesOption) => Promise<void>;
	onDelete: (rowId: number) => Promise<void>;
	onPageChange: (page: number) => void;
}) {
	const [index, setIndex] = useState(0);
	const [action, setAction] = useState<Action | null>(null);
	const [picker, setPicker] = useState<ReviewCandidate | null>(null);
	const [query, setQuery] = useState("");
	const rows = page.candidates;
	const row = rows[Math.min(index, Math.max(0, rows.length - 1))];
	const pageCount = Math.max(1, Math.ceil(page.total / page.pageSize));
	const paged = pageCount > 1;
	const queueNumber = (item: ReviewCandidate) =>
		(page.page - 1) * page.pageSize + page.candidates.indexOf(item) + 1;
	const widest = (page.page - 1) * page.pageSize + page.candidates.length;
	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		return (
			q
				? species.filter((s) =>
						`${s.comName} ${s.sciName}`.toLowerCase().includes(q),
					)
				: species
		).slice(0, 100);
	}, [query, species]);
	async function confirm() {
		if (!action) return;
		if (action.kind === "correct") await onCorrect(action.row.rowId);
		else if (action.kind === "delete") await onDelete(action.row.rowId);
		else await onRecategorize(action.row.rowId, action.species);
		setAction(null);
		setIndex(0);
	}
	if (!row) {
		const message = !page.hasAnyDetections
			? EMPTY.station.detections
			: page.page < pageCount
				? EMPTY.done.reviewPage
				: EMPTY.done.reviewQueue;
		return (
			<ReviewWorkflowEmpty
				message={message}
				total={page.total}
				nextPage={
					page.page < pageCount ? () => onPageChange(page.page + 1) : undefined
				}
			/>
		);
	}
	const heard = (
		<ClipMeta
			heardAt={formatDateTime(row.date, row.time)}
			confidence={row.confidence}
		/>
	);
	return (
		<>
			<div className="@container/review">
				<div className={REVIEW_GRID_CLASS}>
					<section
						aria-label="Detection under review"
						className={UNDER_REVIEW_CLASS}
					>
						<CardHeader title="Under review" />
						<div className={IDENTITY_ROW_CLASS}>
							<div className={PORTRAIT_CLASS}>
								<SpeciesImage
									imageUrl={row.imageUrl}
									alt={row.comName}
									glyphClassName="size-10"
								/>
							</div>
							<div className={IDENTITY_TEXT_CLASS}>
								<h2
									title={row.comName}
									className={`${NAME_CLASS} w-full truncate text-moss`}
								>
									<Link
										to="/birds/$comName"
										params={{ comName: comNameToSlug(row.comName) }}
										className="no-underline hover:underline"
									>
										{row.comName}
									</Link>
								</h2>
								<p
									title={row.sciName}
									className="w-full truncate text-bark text-sm italic leading-tight"
								>
									{row.sciName}
								</p>
								{row.speciesLink && (
									<Button
										asChild
										variant="outline"
										size="sm"
										className={EBIRD_LINK_CLASS}
									>
										<a
											href={row.speciesLink.href}
											target="_blank"
											rel="noreferrer"
											aria-label={`${row.comName} on ${row.speciesLink.site}`}
										>
											<ExternalLink />
											{row.speciesLink.site}
										</a>
									</Button>
								)}
							</div>
						</div>

						{row.audioAvailable ? (
							<SpectrogramPlayer
								key={row.rowId}
								audioUrl={row.audioUrl}
								speciesName={row.comName}
								className={REVIEW_PLOT_CLASS}
								aside={heard}
							/>
						) : (
							<div>
								<p className="grid h-40 place-items-center rounded-md border border-line border-dashed px-4 text-center text-destructive text-sm">
									Audio unavailable. You can delete or skip this orphaned entry.
								</p>
								<div className="mt-page flex flex-wrap items-center justify-end gap-page">
									{heard}
								</div>
							</div>
						)}

						<div className={ACTIONS_FOOTER_CLASS}>
							<Button
								variant="ghost"
								size="default"
								className={DELETE_BUTTON_CLASS}
								disabled={busy}
								onClick={() => setAction({ kind: "delete", row })}
							>
								<Trash2 />
								Delete
							</Button>
							<div className="ml-auto flex items-center gap-page">
								<Button
									variant="outline"
									size="default"
									disabled={!row.audioAvailable || busy}
									onClick={() => setPicker(row)}
								>
									<Shuffle />
									Recategorize
								</Button>
								<Button
									size="default"
									disabled={!row.audioAvailable || busy}
									onClick={() => setAction({ kind: "correct", row })}
								>
									<ShieldCheck />
									Correct
								</Button>
							</div>
						</div>
					</section>

					<section aria-label="Review queue" className={QUEUE_CARD_CLASS}>
						<div className={QUEUE_HEADER_CLASS}>
							<div className="island-kicker">In the queue</div>
							<span className="count-figure">{page.total}</span>
						</div>
						<ol
							style={
								paged ? { minHeight: page.pageSize * ROW_HEIGHT_PX } : undefined
							}
							className="row-well -mx-page divide-y"
						>
							{rows.map((item, i) => {
								const current = item === row;
								const when = formatRecorded(item.date, item.time);
								return (
									<li key={item.rowId}>
										<button
											type="button"
											aria-current={current ? "true" : undefined}
											onClick={() => setIndex(i)}
											className={`${QUEUE_ROW_CLASS} text-left transition-colors duration-[180ms] ${current ? "bg-row-selected" : "hover:bg-meadow"}`}
										>
											<IndexDot index={queueNumber(item)} widest={widest} />
											<SpeciesThumbnail
												imageUrl={item.imageUrl}
												comName={item.comName}
											/>
											<span className="min-w-0 flex-1">
												<span className="block truncate font-medium">
													{item.comName}
												</span>
												<span className="@min-[26rem]:block hidden truncate text-bark text-xs italic">
													{item.sciName}
												</span>
												<span className="block @min-[26rem]:hidden truncate text-muted-foreground text-xs tabular-nums">
													{formatDateTime(item.date, item.time)}
												</span>
											</span>
											<span className={QUEUE_TIME_CLASS}>
												<span className="block text-sm tabular-nums">
													{when.day}
												</span>
												<span className="block text-muted-foreground text-xs tabular-nums">
													{when.clock}
												</span>
											</span>
											<ConfidencePill
												confidence={item.confidence}
												className="shrink-0"
											/>
										</button>
									</li>
								);
							})}
						</ol>
						<div className={QUEUE_FOOTER_CLASS}>
							<PageStepper
								className="ml-auto"
								variant="ghost"
								label="Review queue pages"
								page={page.page}
								pageCount={pageCount}
								onPageChange={onPageChange}
							/>
						</div>
					</section>
				</div>
			</div>
			{picker ? (
				<div
					role="dialog"
					aria-modal="true"
					aria-labelledby="recategorize-review-title"
					className={MODAL_BACKDROP_CLASS}
				>
					<div className={`${MODAL_CARD_CLASS} max-h-[80vh] max-w-xl`}>
						<h2 id="recategorize-review-title" className={MODAL_TITLE_CLASS}>
							Choose the correct species
						</h2>
						<div className="relative">
							<Search
								aria-hidden="true"
								className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								className="pl-9"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search any BirdNET species"
								autoFocus
							/>
						</div>
						<div className="-m-1 min-h-0 flex-1 space-y-1 overflow-auto p-1">
							{matches.map((item) => (
								<button
									type="button"
									className="w-full scroll-my-1 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
									key={item.sciName}
									onClick={() => {
										setAction({
											kind: "recategorize",
											row: picker,
											species: item,
										});
										setPicker(null);
									}}
								>
									<span className="font-medium">{item.comName}</span>
									<span className="ml-2 text-muted-foreground text-xs italic">
										{item.sciName}
									</span>
								</button>
							))}
							{matches.length === 0 ? (
								<p className="px-3 py-2 text-foreground text-sm">
									{EMPTY.filter.recategorizeSearch(query.trim())}
								</p>
							) : null}
						</div>
						<div className={MODAL_ACTIONS_CLASS}>
							<Button
								icon={X}
								variant="outline"
								size="default"
								onClick={() => setPicker(null)}
							>
								Cancel
							</Button>
						</div>
					</div>
				</div>
			) : null}
			{action ? (
				<ConfirmDialog
					title={
						action.kind === "delete"
							? "Delete this detection?"
							: "Confirm correction"
					}
					description={
						action.kind === "correct"
							? `Sign off on this ${action.row.comName}? It leaves the queue, and BirdNET's ${formatConfidence(action.row.confidence)} score is kept as recorded.`
							: action.kind === "delete"
								? `This permanently removes the ${action.row.comName} record and its unreferenced audio. This cannot be undone.`
								: `Change this ${action.row.comName} to ${action.species.comName}? The recording is renamed to match and leaves the queue.`
					}
					cancelIcon={X}
					confirmIcon={action.kind === "delete" ? Trash2 : Check}
					confirmLabel={
						action.kind === "delete" ? "Delete detection" : "Confirm correction"
					}
					destructive={action.kind === "delete"}
					pending={busy}
					onCancel={() => setAction(null)}
					onConfirm={confirm}
				/>
			) : null}
		</>
	);
}

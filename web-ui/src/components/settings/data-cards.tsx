import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	Calendar,
	type Download,
	FileDown,
	RotateCcw,
	Trash2,
	Undo2,
	Upload,
	X,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { destructiveToast, toast } from "~/components/ui/toaster.tsx";
import {
	applyRestoreFn,
	deleteSafetyCopyFn,
	discardStagedBackupFn,
	getDataSummaryFn,
	undoRestoreFn,
} from "~/lib/data.ts";
import {
	type DataSummary,
	detectionExportUrl,
	formatBytes,
	RESTORE_UPLOAD_URL,
	type RestoreOutcome,
	type RestorePreview,
	restorePreviewSchema,
} from "~/lib/data-backup-format.ts";
import { formatDate, formatDateTime } from "~/lib/date-format.ts";
import { PAGE_QUERY, refreshAllData } from "~/lib/query-client.ts";
import { useSkeletonMinimum } from "~/lib/use-skeleton-minimum.ts";
import { errorMessage } from "~/lib/utils.ts";
import { Field, FieldSelect } from "./settings-cards.tsx";
import { settingsCardId } from "./settings-index.ts";

export const DATA_SUMMARY_KEY = ["data-summary"];
const TOAST_ID = "settings-data";
const UPLOAD_TOO_BIG =
	"The upload was cut off. Large backups have to be restored from your home network, so open Songbook there and try again.";

function count(value: number) {
	return value.toLocaleString("en-US");
}

function DataCard({
	title,
	description,
	footer,
	children,
}: {
	title: string;
	description: string;
	footer?: ReactNode;
	children?: ReactNode;
}) {
	const cardId = settingsCardId(title);
	const headingId = `settings-${cardId}`;
	return (
		<Card
			as="section"
			id={cardId}
			aria-labelledby={headingId}
			className="scroll-mt-4"
		>
			<div className="flex h-full flex-col">
				<CardHeader as="h2" titleId={headingId} title={title} />
				<p className="py-page text-muted-foreground text-sm leading-relaxed">
					{description}
				</p>
				<div className="flex-1">{children}</div>
				{footer ? (
					<div className="-mx-page flex flex-wrap items-center justify-end gap-page border-t px-page pt-page">
						{footer}
					</div>
				) : null}
			</div>
		</Card>
	);
}

function DownloadLink({
	href,
	icon,
	label,
}: {
	href: string;
	icon: typeof Download;
	label: string;
}) {
	return (
		<Button asChild size="default" icon={icon}>
			<a href={href} download>
				{label}
			</a>
		</Button>
	);
}

function uploadBackup(file: File, onProgress: (percent: number) => void) {
	const request = new XMLHttpRequest();
	const finished = new Promise<RestorePreview | null>((resolve, reject) => {
		request.upload.onprogress = (event) => {
			if (event.lengthComputable)
				onProgress(Math.round((event.loaded / event.total) * 100));
		};
		request.onabort = () => resolve(null);
		request.onerror = () => reject(new Error(UPLOAD_TOO_BIG));
		request.onload = () => {
			let body: unknown = null;
			try {
				body = JSON.parse(request.responseText);
			} catch {}
			if (request.status === 200) {
				const preview = restorePreviewSchema.safeParse(body);
				if (preview.success) return resolve(preview.data);
				return reject(new Error("The station sent an unexpected answer."));
			}
			if (request.status === 413) return reject(new Error(UPLOAD_TOO_BIG));
			const message = (body as { message?: unknown } | null)?.message;
			reject(
				new Error(
					typeof message === "string"
						? message
						: "The backup couldn't be received.",
				),
			);
		};
	});
	request.open("POST", RESTORE_UPLOAD_URL);
	request.setRequestHeader("Content-Type", "application/x-tar");
	request.send(file);
	return { finished, cancel: () => request.abort() };
}

function Figure({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0">
			<Kicker>{label}</Kicker>
			<p className="font-semibold text-xl tabular-nums">{value}</p>
		</div>
	);
}

function StagedBackup({ staged }: { staged: RestorePreview }) {
	return (
		<div className="-mx-page space-y-page border-t px-page py-page">
			<p className="text-sm">
				This backup of {staged.stationName || "a station"} was saved{" "}
				{formatDateTime(staged.createdAt)} and passed its checks.
			</p>
			<div className="grid grid-cols-2 gap-page sm:grid-cols-4">
				<Figure label="Detections" value={count(staged.detections)} />
				<Figure label="Species" value={count(staged.species)} />
				<Figure
					label="Clips"
					value={staged.includesClips ? count(staged.clipFiles) : "None"}
				/>
				<Figure
					label="Size of clips"
					value={staged.includesClips ? formatBytes(staged.clipBytes) : "None"}
				/>
			</div>
			{staged.firstDate && staged.lastDate ? (
				<p className="text-muted-foreground text-sm">
					Detections from {formatDate(staged.firstDate)} to{" "}
					{formatDate(staged.lastDate)}.
				</p>
			) : null}
		</div>
	);
}

function UploadProgress({
	percent,
	onCancel,
}: {
	percent: number;
	onCancel: () => void;
}) {
	const checking = percent >= 100;
	return (
		<div className="-mx-page space-y-page border-t px-page py-page">
			<p className="text-sm">
				{checking
					? "Checking the backup. Nothing on the station has changed."
					: `Uploading the backup: ${percent}%. Nothing on the station has changed.`}
			</p>
			<div
				role="progressbar"
				aria-label="Backup upload"
				aria-valuenow={percent}
				aria-valuemin={0}
				aria-valuemax={100}
				className="h-2 overflow-hidden rounded-full bg-track"
			>
				<div className="h-full bg-moss" style={{ width: `${percent}%` }} />
			</div>
			{checking ? null : (
				<Button variant="outline" size="default" icon={X} onClick={onCancel}>
					Cancel upload
				</Button>
			)}
		</div>
	);
}

function outcomeToast(outcome: RestoreOutcome) {
	if (outcome.warning)
		toast.warning(outcome.message, {
			id: TOAST_ID,
			description: outcome.warning,
			duration: 15_000,
		});
	else toast.success(outcome.message, { id: TOAST_ID });
}

function SafetyCopyRow({
	createdAt,
	onDone,
}: {
	createdAt: string;
	onDone: () => Promise<void>;
}) {
	const undoFn = useServerFn(undoRestoreFn);
	const deleteFn = useServerFn(deleteSafetyCopyFn);
	const [confirming, setConfirming] = useState<"delete" | "undo" | null>(null);
	const undo = useMutation({
		mutationFn: () => undoFn(),
		onSuccess: async (outcome) => {
			setConfirming(null);
			outcomeToast(outcome);
			await onDone();
		},
		onError: (error) => {
			setConfirming(null);
			toast.error(errorMessage(error, "The undo didn't finish."), {
				id: TOAST_ID,
			});
		},
	});
	const remove = useMutation({
		mutationFn: () => deleteFn(),
		onSuccess: async () => {
			setConfirming(null);
			destructiveToast("Safety copy deleted.", { id: TOAST_ID });
			await onDone();
		},
		onError: (error) => {
			setConfirming(null);
			toast.error(errorMessage(error, "The safety copy wasn't deleted."), {
				id: TOAST_ID,
			});
		},
	});
	return (
		<>
			<Field
				label="Safety copy"
				readOnly
				hint={`Your station as it was before the restore on ${formatDateTime(createdAt)}. It takes up disk space until you undo or delete it, and you need to do one of those before restoring again.`}
			>
				<div className="flex flex-wrap justify-end gap-page">
					<Button
						variant="outline"
						size="default"
						icon={Trash2}
						onClick={() => setConfirming("delete")}
					>
						Delete
					</Button>
					<Button
						variant="outline"
						size="default"
						icon={Undo2}
						onClick={() => setConfirming("undo")}
					>
						Undo restore
					</Button>
				</div>
			</Field>
			{confirming === "undo" ? (
				<ConfirmDialog
					title="Undo the last restore?"
					description="The station goes back to how it was before the restore. Anything recorded since then is lost, and recording pauses for a moment."
					confirmIcon={Undo2}
					confirmLabel="Undo restore"
					destructive
					pending={undo.isPending}
					onCancel={() => setConfirming(null)}
					onConfirm={() => undo.mutate()}
				/>
			) : null}
			{confirming === "delete" ? (
				<ConfirmDialog
					title="Delete the safety copy?"
					description="You won't be able to undo the last restore after this. This cannot be undone."
					confirmIcon={Trash2}
					confirmLabel="Delete safety copy"
					destructive
					pending={remove.isPending}
					onCancel={() => setConfirming(null)}
					onConfirm={() => remove.mutate()}
				/>
			) : null}
		</>
	);
}

function RestoreCard({
	summary,
	onChanged,
}: {
	summary: DataSummary | undefined;
	onChanged: () => Promise<void>;
}) {
	const queryClient = useQueryClient();
	const applyFn = useServerFn(applyRestoreFn);
	const discardFn = useServerFn(discardStagedBackupFn);
	const fileInput = useRef<HTMLInputElement>(null);
	const cancelUpload = useRef<(() => void) | null>(null);
	const [percent, setPercent] = useState<number | null>(null);
	const [confirming, setConfirming] = useState(false);
	const staged = summary?.staged ?? null;
	const safetyCopy = summary?.safetyCopy ?? null;

	const clearStaged = () =>
		queryClient.setQueryData<DataSummary>(DATA_SUMMARY_KEY, (current) =>
			current ? { ...current, staged: null } : current,
		);

	const upload = async (file: File) => {
		setPercent(0);
		const { finished, cancel } = uploadBackup(file, setPercent);
		cancelUpload.current = cancel;
		try {
			const preview = await finished;
			if (preview)
				queryClient.setQueryData<DataSummary>(DATA_SUMMARY_KEY, (current) =>
					current ? { ...current, staged: preview } : current,
				);
		} catch (error) {
			toast.error(errorMessage(error, "The backup couldn't be received."), {
				id: TOAST_ID,
				duration: 15_000,
			});
		} finally {
			cancelUpload.current = null;
			setPercent(null);
		}
	};

	const apply = useMutation({
		mutationFn: (id: string) => applyFn({ data: { id } }),
		onSuccess: async (outcome) => {
			setConfirming(false);
			clearStaged();
			outcomeToast(outcome);
			await onChanged();
		},
		onError: async (error) => {
			setConfirming(false);
			toast.error(errorMessage(error, "The restore failed."), {
				id: TOAST_ID,
				duration: 15_000,
			});
			await onChanged();
		},
	});
	const discard = useMutation({
		mutationFn: () => discardFn(),
		onSuccess: async () => {
			clearStaged();
			await onChanged();
		},
		onError: (error) => {
			toast.error(errorMessage(error, "The upload wasn't discarded."), {
				id: TOAST_ID,
			});
		},
	});

	const footer =
		percent !== null ? null : staged ? (
			<>
				<Button
					variant="outline"
					size="default"
					icon={X}
					disabled={discard.isPending}
					onClick={() => discard.mutate()}
				>
					Discard
				</Button>
				<Button
					variant="destructive"
					size="default"
					icon={RotateCcw}
					onClick={() => setConfirming(true)}
				>
					Restore this backup
				</Button>
			</>
		) : (
			<Button
				size="default"
				icon={Upload}
				disabled={!summary || safetyCopy !== null}
				onClick={() => fileInput.current?.click()}
			>
				Choose backup file
			</Button>
		);

	return (
		<DataCard
			title="Restore"
			description="Replace this station's data with a Songbook backup. The file is fully checked before anything changes, and you decide after seeing what's in it. Backups over 100 MB may need to be restored from your home network."
			footer={footer}
		>
			<input
				ref={fileInput}
				type="file"
				accept=".tar"
				hidden
				aria-label="Backup file"
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = "";
					if (file) void upload(file);
				}}
			/>
			{safetyCopy ? (
				<SafetyCopyRow createdAt={safetyCopy.createdAt} onDone={onChanged} />
			) : null}
			{percent !== null ? (
				<UploadProgress
					percent={percent}
					onCancel={() => cancelUpload.current?.()}
				/>
			) : staged ? (
				<StagedBackup staged={staged} />
			) : null}
			{confirming && staged ? (
				<ConfirmDialog
					title="Replace this station's data?"
					description={`The ${count(summary?.detections ?? 0)} detections on this station are replaced by the ${count(staged.detections)} in this backup, along with its settings and species lists. Recording pauses while this runs.`}
					confirmIcon={RotateCcw}
					confirmLabel="Replace data"
					destructive
					pending={apply.isPending}
					onCancel={() => setConfirming(false)}
					onConfirm={() => apply.mutate(staged.id)}
				>
					<p className="text-muted-foreground text-xs leading-relaxed">
						{staged.includesClips
							? "This station's clips are replaced by the ones in the backup."
							: "This backup has no clips, so the clips on this station stay where they are."}{" "}
						A safety copy of the station is kept first, so you can undo this
						afterwards.
					</p>
				</ConfirmDialog>
			) : null}
		</DataCard>
	);
}

function DateField({
	label,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	value: string;
	min?: string;
	max?: string;
	onChange: (value: string) => void;
}) {
	return (
		<Field label={label} readOnly>
			<div className="relative flex h-8.5 pointer-coarse:h-9 items-center gap-2 rounded-md border border-input bg-card px-3 pointer-coarse:text-base text-sm transition-colors hover:bg-accent">
				<Calendar
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden="true"
				/>
				<span className={value ? "" : "text-muted-foreground"}>
					{value ? formatDate(value) : "Any date"}
				</span>
				<input
					aria-label={label}
					className="absolute inset-0 size-full cursor-pointer text-base opacity-0"
					type="date"
					value={value}
					min={min}
					max={max}
					onClick={(event) => {
						try {
							event.currentTarget.showPicker?.();
						} catch {}
					}}
					onChange={(event) => onChange(event.target.value)}
				/>
			</div>
		</Field>
	);
}

function ExportCard({ summary }: { summary: DataSummary | undefined }) {
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [species, setSpecies] = useState("");
	return (
		<DataCard
			title="Export detections"
			description="Download detections as a spreadsheet, to read yourself or bring into another tool. This doesn't include clips, and it can't rebuild a station; use a backup for that."
			footer={
				<DownloadLink
					href={detectionExportUrl({
						from: from || undefined,
						to: to || undefined,
						species: species || undefined,
					})}
					icon={FileDown}
					label="Download CSV"
				/>
			}
		>
			<DateField
				label="From"
				value={from}
				min={summary?.firstDate ?? undefined}
				max={to || (summary?.lastDate ?? undefined)}
				onChange={setFrom}
			/>
			<DateField
				label="To"
				value={to}
				min={from || (summary?.firstDate ?? undefined)}
				max={summary?.lastDate ?? undefined}
				onChange={setTo}
			/>
			<Field label="Species">
				<FieldSelect
					value={species}
					onChange={(event) => setSpecies(event.target.value)}
				>
					<option value="">All species</option>
					{summary?.species.map((bird) => (
						<option key={bird.sciName} value={bird.sciName}>
							{bird.comName}
						</option>
					))}
				</FieldSelect>
			</Field>
		</DataCard>
	);
}

export function DataCards({ active }: { active: boolean }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data } = useQuery({
		...PAGE_QUERY,
		queryKey: DATA_SUMMARY_KEY,
		queryFn: () => getDataSummaryFn(),
		enabled: active,
	});
	const summary = useSkeletonMinimum(data);
	return (
		<div className="space-y-page">
			<RestoreCard
				summary={summary}
				onChanged={async () => {
					await refreshAllData(router, queryClient);
				}}
			/>
			<ExportCard summary={summary} />
		</div>
	);
}

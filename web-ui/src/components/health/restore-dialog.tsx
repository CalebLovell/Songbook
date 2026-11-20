import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcw, Trash2, Undo2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import {
	ConfirmDialog,
	MODAL_ACTIONS_CLASS,
} from "~/components/ui/confirm-dialog.tsx";
import { Kicker } from "~/components/ui/kicker.tsx";
import { ModalDialog } from "~/components/ui/modal-dialog.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import {
	applyRestoreFn,
	deleteSafetyCopyFn,
	discardStagedBackupFn,
	getDataSummaryFn,
	undoRestoreFn,
} from "~/lib/data.ts";
import {
	type DataSummary,
	formatBytes,
	RESTORE_UPLOAD_URL,
	type RestoreOutcome,
	type RestorePreview,
	restorePreviewSchema,
} from "~/lib/data-backup-format.ts";
import { formatDate, formatDateTime } from "~/lib/date-format.ts";
import { PAGE_QUERY, refreshAllData } from "~/lib/query-client.ts";
import { errorMessage } from "~/lib/utils.ts";

export const DATA_SUMMARY_KEY = ["data-summary"];

export const dataSummaryQuery = {
	...PAGE_QUERY,
	queryKey: DATA_SUMMARY_KEY,
	queryFn: () => getDataSummaryFn(),
};

const TOAST_ID = "health-restore";
const UPLOAD_TOO_BIG =
	"The upload was cut off. Large backups have to be restored from your home network, so open Songbook there and try again.";

function count(value: number) {
	return value.toLocaleString("en-US");
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
			<p className="m-0 font-semibold text-xl tabular-nums">{value}</p>
		</div>
	);
}

function StagedBackup({ staged }: { staged: RestorePreview }) {
	return (
		<div className="space-y-page rounded-md bg-muted p-page">
			<p className="m-0 text-sm">
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
				<p className="m-0 text-muted-foreground text-sm">
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
		<div className="space-y-page">
			<p className="m-0 text-sm">
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

function SafetyCopy({
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
			toast.success("Safety copy deleted.", { id: TOAST_ID });
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
		<div className="space-y-page rounded-md bg-muted p-page">
			<div>
				<p className="m-0 font-semibold text-sm">Safety copy</p>
				<p className="m-0 text-muted-foreground text-xs leading-relaxed">
					Your station as it was before the restore on{" "}
					{formatDateTime(createdAt)}. It takes up disk space until you undo or
					delete it, and you need to do one of those before restoring again.
				</p>
			</div>
			<div className="flex flex-wrap gap-page">
				<Button
					variant="outline"
					size="default"
					icon={Undo2}
					onClick={() => setConfirming("undo")}
				>
					Undo restore
				</Button>
				<Button
					variant="outline"
					size="default"
					icon={Trash2}
					onClick={() => setConfirming("delete")}
				>
					Delete
				</Button>
			</div>
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
		</div>
	);
}

function RestoreDialog({ onClose }: { onClose: () => void }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const { data: summary } = useQuery(dataSummaryQuery);
	const applyFn = useServerFn(applyRestoreFn);
	const discardFn = useServerFn(discardStagedBackupFn);
	const fileInput = useRef<HTMLInputElement>(null);
	const cancelUpload = useRef<(() => void) | null>(null);
	const [percent, setPercent] = useState<number | null>(null);
	const [confirming, setConfirming] = useState(false);
	const staged = summary?.staged ?? null;
	const safetyCopy = summary?.safetyCopy ?? null;

	const onChanged = async () => {
		await refreshAllData(router, queryClient);
	};

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
			onClose();
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

	const close = () => {
		cancelUpload.current?.();
		onClose();
	};

	return (
		<ModalDialog title="Restore a backup" className="max-w-xl" onClose={close}>
			<p className="m-0 text-muted-foreground text-sm leading-relaxed">
				Replace this station's data with a Songbook backup. The file is fully
				checked before anything changes, and you decide after seeing what's in
				it. Backups over 100 MB may need to be restored from your home network.
			</p>
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
				<SafetyCopy createdAt={safetyCopy.createdAt} onDone={onChanged} />
			) : null}
			{percent !== null ? (
				<UploadProgress
					percent={percent}
					onCancel={() => cancelUpload.current?.()}
				/>
			) : staged ? (
				<StagedBackup staged={staged} />
			) : null}
			<div className={MODAL_ACTIONS_CLASS}>
				<Button
					type="button"
					variant="outline"
					size="lg"
					icon={X}
					onClick={close}
				>
					Close
				</Button>
				{percent !== null ? null : staged ? (
					<>
						<Button
							variant="outline"
							size="lg"
							icon={Trash2}
							disabled={discard.isPending}
							onClick={() => discard.mutate()}
						>
							Discard
						</Button>
						<Button
							variant="destructive"
							size="lg"
							icon={RotateCcw}
							onClick={() => setConfirming(true)}
						>
							Restore this backup
						</Button>
					</>
				) : (
					<Button
						size="lg"
						icon={Upload}
						disabled={!summary || safetyCopy !== null}
						onClick={() => fileInput.current?.click()}
					>
						Choose backup file
					</Button>
				)}
			</div>
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
		</ModalDialog>
	);
}

export function RestoreButton({ primary }: { primary: boolean }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				type="button"
				variant={primary ? "default" : "outline"}
				size="default"
				icon={Upload}
				onClick={() => setOpen(true)}
			>
				Restore a backup
			</Button>
			{open ? <RestoreDialog onClose={() => setOpen(false)} /> : null}
		</>
	);
}

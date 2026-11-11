import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { useState } from "react";

import { DATA_SUMMARY_KEY } from "~/components/settings/data-cards.tsx";
import { FieldChoice } from "~/components/settings/settings-cards.tsx";
import { Button } from "~/components/ui/button.tsx";
import { MODAL_ACTIONS_CLASS } from "~/components/ui/confirm-dialog.tsx";
import { ModalDialog } from "~/components/ui/modal-dialog.tsx";
import { ShellText } from "~/components/ui/shell.tsx";
import { getDataSummaryFn } from "~/lib/data.ts";
import {
	backupUrl,
	type DataSummary,
	formatBytes,
} from "~/lib/data-backup-format.ts";
import { PAGE_QUERY } from "~/lib/query-client.ts";

type Contents = "clips" | "records";

function count(value: number) {
	return value.toLocaleString("en-US");
}

function backupContents(summary: DataSummary, includeClips: boolean) {
	const records = `${count(summary.detections)} detections, your settings and species lists`;
	if (!includeClips)
		return `${records}. About ${formatBytes(summary.databaseBytes)}. The ${count(summary.clipFiles)} clips stay behind.`;
	return `${records}, and ${count(summary.clipFiles)} clips. About ${formatBytes(summary.databaseBytes + summary.clipBytes)}.`;
}

function BackupDialog({ onClose }: { onClose: () => void }) {
	const [contents, setContents] = useState<Contents>("clips");
	const includeClips = contents === "clips";
	const { data: summary } = useQuery({
		...PAGE_QUERY,
		queryKey: DATA_SUMMARY_KEY,
		queryFn: () => getDataSummaryFn(),
	});
	return (
		<ModalDialog
			title="Download a backup"
			className="max-w-lg"
			onClose={onClose}
		>
			<p className="m-0 text-muted-foreground text-sm leading-relaxed">
				A copy of this station to keep somewhere safe, or to start a new station
				from. Recording keeps running while it downloads. Your sign-in password
				and audio input stay out, because they belong to the machine.
			</p>
			<div className="flex flex-col gap-1.5">
				<span className="font-semibold text-sm">What to include</span>
				<FieldChoice
					value={contents}
					options={[
						{ value: "clips", label: "Everything" },
						{ value: "records", label: "Without clips" },
					]}
					onChange={setContents}
				/>
				{summary ? (
					<p className="m-0 text-muted-foreground text-xs leading-relaxed">
						{backupContents(summary, includeClips)}
					</p>
				) : (
					<ShellText className="text-xs leading-relaxed" barClassName="w-64" />
				)}
			</div>
			<div className={MODAL_ACTIONS_CLASS}>
				<Button
					type="button"
					variant="outline"
					size="lg"
					icon={X}
					onClick={onClose}
				>
					Cancel
				</Button>
				<Button asChild size="lg" icon={Download}>
					<a href={backupUrl(includeClips)} download onClick={onClose}>
						Download
					</a>
				</Button>
			</div>
		</ModalDialog>
	);
}

export function BackupButton() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="default"
				icon={Download}
				onClick={() => setOpen(true)}
			>
				Download a backup
			</Button>
			{open ? <BackupDialog onClose={() => setOpen(false)} /> : null}
		</>
	);
}

import { Trash2, X } from "lucide-react";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { plural } from "~/lib/number-format.ts";

type DeleteDetectionsDialogProps = {
	count: number;
	pending: boolean;
	onCancel: () => void;
	onConfirm: () => void;
};

export function DeleteDetectionsDialog({
	count,
	pending,
	onCancel,
	onConfirm,
}: DeleteDetectionsDialogProps) {
	const noun = plural(count, "detection");
	return (
		<ConfirmDialog
			title={`Delete ${count} ${noun}?`}
			description={`This permanently removes ${count} ${plural(count, "detection record")} and their unreferenced extracted audio files. This cannot be undone.`}
			cancelIcon={X}
			confirmIcon={Trash2}
			confirmLabel={`Delete ${count} ${noun}`}
			destructive
			pending={pending}
			onCancel={onCancel}
			onConfirm={onConfirm}
		/>
	);
}

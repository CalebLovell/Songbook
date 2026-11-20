import { SlidersHorizontal } from "lucide-react";
import { type ChangeEvent, type SyntheticEvent, useState } from "react";

import { Field, FieldInput, numberOr } from "~/components/form-fields.tsx";
import { Button } from "~/components/ui/button.tsx";
import { ModalDialog } from "~/components/ui/modal-dialog.tsx";
import type {
	DetectionSettings,
	SettingsSaveResult,
} from "~/lib/settings-data.ts";
import { DialogActions, useDialogSave } from "./station-dialogs.tsx";

export type DetectionEditing = {
	values: DetectionSettings;
	save: (
		values: DetectionSettings,
	) => Promise<SettingsSaveResult<DetectionSettings>>;
};

function DetectionDialog({
	editing,
	onClose,
}: {
	editing: DetectionEditing;
	onClose: () => void;
}) {
	const [values, setValues] = useState(editing.values);
	const save = useDialogSave(editing.save, onClose);
	const number =
		(key: keyof DetectionSettings) => (event: ChangeEvent<HTMLInputElement>) =>
			setValues({ ...values, [key]: numberOr(event, values[key]) });
	function submit(event: SyntheticEvent) {
		event.preventDefault();
		save.mutate(values);
	}
	return (
		<ModalDialog title="Detection" className="max-w-lg" onClose={onClose}>
			<form onSubmit={submit} className="flex flex-col gap-page">
				<p className="m-0 text-muted-foreground text-sm leading-relaxed">
					Which model predictions become saved detections, and which sounds are
					dropped as human. Saving restarts BirdNET, which interrupts recording
					for a moment.
				</p>
				<div className="grid gap-page sm:grid-cols-2">
					<Field
						stacked
						label="Minimum confidence"
						hint="Higher saves fewer, surer predictions."
					>
						<FieldInput
							type="number"
							min={0.01}
							max={0.99}
							step={0.01}
							required
							value={values.confidence}
							onChange={number("confidence")}
						/>
					</Field>
					<Field
						stacked
						label="Sensitivity"
						hint="Higher saves fewer detections, not more."
						info={
							<>
								Higher values pull every score toward 50% before Minimum
								confidence is applied. A call scoring 88% at 1.0 scores 82% at
								1.25 and 73% at 1.5. Lower it to save more detections, raise it
								to save fewer.
							</>
						}
					>
						<FieldInput
							type="number"
							min={0.5}
							max={1.5}
							step={0.05}
							required
							value={values.sensitivity}
							onChange={number("sensitivity")}
						/>
					</Field>
					<Field
						stacked
						label="Analysis overlap"
						hint="More overlap covers more, using more compute."
					>
						<FieldInput
							type="number"
							min={0}
							max={2.9}
							step={0.1}
							required
							unit="s"
							value={values.overlap}
							onChange={number("overlap")}
						/>
					</Field>
					<Field
						stacked
						label="Privacy threshold"
						hint="Higher catches fainter voices, and drops more birds."
						info={
							<>
								Speech is filtered even at 0. BirdNET drops a chunk when a human
								sound is among its top 10 guesses for it at 0, its top 60 at 1,
								and its top 180 at 3. The chunks either side are dropped too, so
								a saved 6-second clip never reaches into the speech it found.
								The live stream is never filtered.
							</>
						}
					>
						<FieldInput
							type="number"
							min={0}
							max={3}
							step={0.1}
							required
							value={values.privacyThreshold}
							onChange={number("privacyThreshold")}
						/>
					</Field>
				</div>
				<DialogActions pending={save.isPending} onCancel={onClose} />
			</form>
		</ModalDialog>
	);
}

export function DetectionButton({
	editing,
}: {
	editing: DetectionEditing | null;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="default"
				icon={SlidersHorizontal}
				disabled={!editing}
				onClick={() => setOpen(true)}
			>
				Tune detection
			</Button>
			{open && editing ? (
				<DetectionDialog editing={editing} onClose={() => setOpen(false)} />
			) : null}
		</>
	);
}

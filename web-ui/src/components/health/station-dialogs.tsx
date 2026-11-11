import { useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { type ReactNode, type SyntheticEvent, useId, useState } from "react";

import { StationLocation } from "~/components/settings/station-location.tsx";
import { Button } from "~/components/ui/button.tsx";
import { MODAL_ACTIONS_CLASS } from "~/components/ui/confirm-dialog.tsx";
import { Input } from "~/components/ui/input.tsx";
import { ModalDialog } from "~/components/ui/modal-dialog.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import type {
	SettingsSaveResult,
	StationSettings,
} from "~/lib/settings-data.ts";
import { modernTimezone } from "~/lib/timezones.ts";
import { useClientValue } from "~/lib/use-client-value.ts";
import { errorMessage } from "~/lib/utils.ts";

export type StationSaver = (
	values: StationSettings,
) => Promise<SettingsSaveResult<StationSettings>>;

export type StationEditing = {
	values: StationSettings;
	timezones: string[];
	save: StationSaver;
};

const TOAST_ID = "health-station";

function useStationSave(save: StationSaver, onSaved: () => void) {
	return useMutation({
		mutationFn: save,
		onMutate: () => toast.loading("Saving…", { id: TOAST_ID }),
		onSuccess: (result) => {
			const pending =
				result.status === "saved-action-failed" ||
				result.status === "saved-restart-skipped";
			if (pending)
				toast.warning(result.message, { id: TOAST_ID, duration: 10_000 });
			else toast.success(result.message, { id: TOAST_ID });
			onSaved();
		},
		onError: (error) =>
			toast.error(errorMessage(error, "This couldn't be saved."), {
				id: TOAST_ID,
			}),
	});
}

function Field({
	id,
	label,
	hint,
	children,
}: {
	id: string;
	label: string;
	hint?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="font-semibold text-sm">
				{label}
			</label>
			{children}
			{hint ? (
				<div className="text-muted-foreground text-xs leading-relaxed">
					{hint}
				</div>
			) : null}
		</div>
	);
}

function DialogActions({
	pending,
	onCancel,
}: {
	pending: boolean;
	onCancel: () => void;
}) {
	return (
		<div className={MODAL_ACTIONS_CLASS}>
			<Button
				type="button"
				variant="outline"
				size="lg"
				icon={X}
				onClick={onCancel}
			>
				Cancel
			</Button>
			<Button type="submit" size="lg" icon={Check} loading={pending}>
				Save
			</Button>
		</div>
	);
}

export function StationNameDialog({
	editing,
	onClose,
}: {
	editing: StationEditing;
	onClose: () => void;
}) {
	const id = useId();
	const [siteName, setSiteName] = useState(editing.values.siteName);
	const save = useStationSave(editing.save, onClose);
	function submit(event: SyntheticEvent) {
		event.preventDefault();
		save.mutate({ ...editing.values, siteName });
	}
	return (
		<ModalDialog title="Station name" className="max-w-lg" onClose={onClose}>
			<form onSubmit={submit} className="flex flex-col gap-page">
				<Field
					id={id}
					label="Station name"
					hint="Shown to visitors at the top of every page."
				>
					<Input
						id={id}
						value={siteName}
						maxLength={80}
						required
						autoComplete="off"
						onChange={(event) => setSiteName(event.target.value)}
					/>
				</Field>
				<DialogActions pending={save.isPending} onCancel={onClose} />
			</form>
		</ModalDialog>
	);
}

function numberOr(value: number, fallback: number) {
	return Number.isNaN(value) ? fallback : value;
}

function BrowserTimezoneHint({
	timezone,
	onUse,
}: {
	timezone: string;
	onUse: (timezone: string) => void;
}) {
	const browserTimezone = useClientValue<string | null>(
		() => modernTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone),
		null,
	);
	if (!browserTimezone || modernTimezone(timezone) === browserTimezone)
		return null;
	return (
		<p className="m-0">
			This browser is on <span className="font-medium">{browserTimezone}</span>.{" "}
			<button
				type="button"
				onClick={() => onUse(browserTimezone)}
				className="font-medium text-moss underline underline-offset-2"
			>
				Use it
			</button>
		</p>
	);
}

export function LocationDialog({
	editing,
	onClose,
}: {
	editing: StationEditing;
	onClose: () => void;
}) {
	const id = useId();
	const [values, setValues] = useState(editing.values);
	const save = useStationSave(editing.save, onClose);
	function submit(event: SyntheticEvent) {
		event.preventDefault();
		save.mutate(values);
	}
	return (
		<ModalDialog title="Location" className="max-w-lg" onClose={onClose}>
			<form onSubmit={submit} className="flex flex-col gap-page">
				<p className="m-0 text-muted-foreground text-sm leading-relaxed">
					BirdNET uses where the station is to decide which birds live nearby.
				</p>
				<div className="grid grid-cols-2 gap-page">
					<Field id={`${id}-lat`} label="Latitude">
						<Input
							id={`${id}-lat`}
							type="number"
							min={-90}
							max={90}
							step="any"
							required
							value={values.latitude}
							onChange={(event) =>
								setValues({
									...values,
									latitude: numberOr(
										event.target.valueAsNumber,
										values.latitude,
									),
								})
							}
						/>
					</Field>
					<Field id={`${id}-lon`} label="Longitude">
						<Input
							id={`${id}-lon`}
							type="number"
							min={-180}
							max={180}
							step="any"
							required
							value={values.longitude}
							onChange={(event) =>
								setValues({
									...values,
									longitude: numberOr(
										event.target.valueAsNumber,
										values.longitude,
									),
								})
							}
						/>
					</Field>
				</div>
				<StationLocation
					current={{ latitude: values.latitude, longitude: values.longitude }}
					onApply={(coordinates) => setValues({ ...values, ...coordinates })}
				/>
				<Field
					id={`${id}-tz`}
					label="Time zone"
					hint={
						<>
							<p className="m-0">
								Type to search, e.g. “New York”. Also sets the station's clock.
							</p>
							<BrowserTimezoneHint
								timezone={values.timezone}
								onUse={(timezone) => setValues({ ...values, timezone })}
							/>
						</>
					}
				>
					<Input
						id={`${id}-tz`}
						list={`${id}-timezones`}
						autoComplete="off"
						spellCheck={false}
						required
						value={values.timezone}
						onChange={(event) =>
							setValues({ ...values, timezone: event.target.value })
						}
					/>
					<datalist id={`${id}-timezones`}>
						{editing.timezones.map((timezone) => (
							<option key={timezone} value={timezone} />
						))}
					</datalist>
				</Field>
				<DialogActions pending={save.isPending} onCancel={onClose} />
			</form>
		</ModalDialog>
	);
}

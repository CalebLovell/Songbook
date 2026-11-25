import { useMutation } from "@tanstack/react-query";
import { RotateCcw, Save, X } from "lucide-react";
import { type ChangeEvent, useState } from "react";

import { CardHeader } from "~/components/card-header.tsx";
import {
	Field,
	FieldChoice,
	FieldInput,
	numberOr,
} from "~/components/form-fields.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import {
	type HighlightSettings,
	PREFERENCE_DEFAULTS,
	type PreferenceSettings,
	type SettingsSaveResult,
} from "~/lib/settings-data.ts";
import { errorMessage } from "~/lib/utils.ts";

export type SettingsWriter = () => Promise<
	SettingsSaveResult<PreferenceSettings>
>;

export type SettingsActions = {
	save: (
		values: PreferenceSettings,
	) => Promise<SettingsSaveResult<PreferenceSettings>>;
	reset: SettingsWriter;
};

const TOAST_ID = "settings";
const HEADING_ID = "settings-card";

const SKELETON_VALUES_CLASS =
	"[&_:is(input,select,textarea)]:animate-pulse! [&_:is(input,select,textarea)]:border-transparent! [&_:is(input,select,textarea)]:bg-muted! [&_:is(input,select,textarea)]:bg-none! [&_:is(input,select,textarea)]:text-transparent! [&_:is(input,textarea)::placeholder]:text-transparent! **:data-[slot=toggle-group-item]:animate-pulse! **:data-[slot=toggle-group-item]:border-paper-raised! **:data-[slot=toggle-group-item]:bg-muted! **:data-[slot=toggle-group-item]:text-transparent!";

function same(a: unknown, b: unknown) {
	return JSON.stringify(a) === JSON.stringify(b);
}

function useSettingsForm(
	initial: PreferenceSettings | undefined,
	actions: SettingsActions,
) {
	const [values, setValues] = useState(initial ?? PREFERENCE_DEFAULTS);
	const [saved, setSaved] = useState(initial ?? PREFERENCE_DEFAULTS);
	const [seenInitial, setSeenInitial] = useState(initial);
	if (!same(initial, seenInitial)) {
		setSeenInitial(initial);
		if (initial) {
			setSaved(initial);
			if (!seenInitial || same(values, saved)) setValues(initial);
		}
	}

	const write = useMutation({
		mutationFn: (run: SettingsWriter) => run(),
		onMutate: () => toast.loading("Saving settings…", { id: TOAST_ID }),
		onSuccess: (result) => {
			setValues(result.values);
			setSaved(result.values);
			toast.success(result.message, { id: TOAST_ID });
		},
		onError: (error) =>
			toast.error(errorMessage(error, "Your settings weren't changed."), {
				id: TOAST_ID,
			}),
	});

	const busy = !initial || write.isPending;
	return {
		values,
		setValues,
		saveDisabled: busy || same(values, saved),
		resetDisabled:
			busy ||
			(same(values, PREFERENCE_DEFAULTS) && same(saved, PREFERENCE_DEFAULTS)),
		save: () => write.mutate(() => actions.save(values)),
		reset: () => write.mutate(actions.reset),
	};
}

export function SettingsCard({
	initial,
	actions,
}: {
	initial: PreferenceSettings | undefined;
	actions: SettingsActions;
}) {
	const loading = !initial;
	const form = useSettingsForm(initial, actions);
	const [confirmingReset, setConfirmingReset] = useState(false);
	const { artwork, playback, highlights } = form.values;
	const setHighlight =
		(key: keyof HighlightSettings) => (event: ChangeEvent<HTMLInputElement>) =>
			form.setValues({
				...form.values,
				highlights: {
					...highlights,
					[key]: numberOr(event, highlights[key]),
				},
			});

	return (
		<Card
			as="section"
			aria-labelledby={HEADING_ID}
			aria-busy={loading}
			inert={loading}
			className={`**:data-[slot=toggle-group-item]:transition-colors ${loading ? SKELETON_VALUES_CLASS : ""}`}
		>
			<form
				className="flex flex-col"
				onSubmit={(event) => {
					event.preventDefault();
					form.save();
				}}
			>
				<CardHeader as="h2" titleId={HEADING_ID} title="Settings" />

				<div className="[&>:first-child]:border-t-0">
					<Field
						label="Show birds as"
						hint="Illustrations are paintings and photos are real photographs. A bird with only one kind always shows that kind."
					>
						<FieldChoice
							value={artwork.preference}
							options={[
								{ value: "illustrations", label: "Illustrations" },
								{ value: "photos", label: "Photos" },
							]}
							onChange={(preference) =>
								form.setValues({ ...form.values, artwork: { preference } })
							}
						/>
					</Field>
					<Field
						label="Boost quiet recordings"
						hint="Makes faint, far-off calls louder, and keeps loud ones from distorting. Live audio has its own controls."
					>
						<FieldChoice
							value={playback.boostQuietRecordings ? "on" : "off"}
							options={[
								{ value: "on", label: "On" },
								{ value: "off", label: "Off" },
							]}
							onChange={(choice) =>
								form.setValues({
									...form.values,
									playback: { boostQuietRecordings: choice === "on" },
								})
							}
						/>
					</Field>

					<Field
						label="Rare"
						hint="A species with this many records or fewer, in all."
						info={
							<p>
								Rare species get a Rare flag on Today and the timeline. Their
								unsure detections go to the Review queue, and they make up
								Learn's Rare selection.
							</p>
						}
					>
						<FieldInput
							type="number"
							min={1}
							max={1000}
							required
							unit="records"
							value={highlights.rareMax}
							onChange={setHighlight("rareMax")}
						/>
					</Field>
					<Field
						label="Returned"
						hint="Back after going unheard for at least this long."
					>
						<FieldInput
							type="number"
							min={2}
							max={90}
							required
							unit="days"
							value={highlights.returnedDays}
							onChange={setHighlight("returnedDays")}
						/>
					</Field>
					<Field
						label="Gone quiet"
						hint="Heard every day for this long, then not today."
					>
						<FieldInput
							type="number"
							min={2}
							max={90}
							required
							unit="days"
							value={highlights.goneQuietDays}
							onChange={setHighlight("goneQuietDays")}
						/>
					</Field>
					<Field
						label="Regular"
						hint="Heard this many days in a row, today included."
					>
						<FieldInput
							type="number"
							min={2}
							max={90}
							required
							unit="days"
							value={highlights.regularDays}
							onChange={setHighlight("regularDays")}
						/>
					</Field>
					<Field
						label="Vocal"
						hint="Calling this many times more than its usual day."
					>
						<FieldInput
							type="number"
							min={1.5}
							max={20}
							step={0.5}
							required
							unit="×"
							value={highlights.vocalRatio}
							onChange={setHighlight("vocalRatio")}
						/>
					</Field>
				</div>

				<div className="-mx-page flex flex-wrap items-center gap-page border-t px-page pt-page">
					<Button
						type="button"
						variant="outline"
						size="default"
						icon={RotateCcw}
						disabled={form.resetDisabled}
						onClick={() => setConfirmingReset(true)}
					>
						Reset settings
					</Button>
					<Button
						type="submit"
						size="default"
						icon={Save}
						className="ml-auto"
						disabled={form.saveDisabled}
					>
						Save
					</Button>
				</div>
			</form>

			{confirmingReset ? (
				<ConfirmDialog
					title="Reset every setting?"
					description="Everything in this card goes back to what a fresh install writes, and edits you haven't saved are dropped. This cannot be undone."
					cancelIcon={X}
					confirmIcon={RotateCcw}
					confirmLabel="Reset settings"
					destructive
					onCancel={() => setConfirmingReset(false)}
					onConfirm={() => {
						setConfirmingReset(false);
						form.reset();
					}}
				>
					<p className="text-muted-foreground text-xs leading-relaxed">
						Your detections, recordings and everything on Station are left as
						they are.
					</p>
				</ConfirmDialog>
			) : null}
		</Card>
	);
}

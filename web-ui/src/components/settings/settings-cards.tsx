import { useMutation } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { createContext, useContext, useId, useState } from "react";

import { InfoTip } from "~/components/ui/info-tip.tsx";
import { Input } from "~/components/ui/input.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import {
	type ArtworkSettings,
	type DetectionSettings,
	type HighlightSettings,
	type PlaybackSettings,
	type ReviewSettings,
	SETTINGS_DEFAULTS,
	type SettingsCardKind,
	type SettingsPageData,
	type SettingsSaveResult,
} from "~/lib/settings-data.ts";
import { errorMessage } from "~/lib/utils.ts";
import { RestartButton } from "./restart-button.tsx";
import { RESET_RESTARTS_DESCRIPTION, SettingsCard } from "./settings-card.tsx";
import { SETTINGS_TABS, type SettingsTab } from "./settings-index.ts";

const RESET_NO_RESTART_DESCRIPTION =
	"Every value in this card goes back to what a fresh install writes, and any edits you haven't saved are dropped. Nothing restarts. Other cards are left as they are.";

type Saver<T> = (values: T) => Promise<SettingsSaveResult<T>>;
type CardRestarter = () => Promise<{ message: string }>;

export type SettingsSavers = {
	detection?: Saver<DetectionSettings>;
	review?: Saver<ReviewSettings>;
	highlights?: Saver<HighlightSettings>;
	artwork?: Saver<ArtworkSettings>;
	playback?: Saver<PlaybackSettings>;
};

export type SettingsRestarter = (
	card?: SettingsCardKind,
) => Promise<{ message: string }>;

function unchanged<T>(a: T, b: T) {
	return JSON.stringify(a) === JSON.stringify(b);
}

function useCardSave<T>(
	title: string,
	initial: T,
	save?: Saver<T>,
	restart?: CardRestarter,
	defaults?: T,
) {
	const toastId = `settings-${title}`;
	const [values, setValues] = useState(initial);
	const [saved, setSaved] = useState(initial);
	const [needsRestart, setNeedsRestart] = useState(false);
	const [seenInitial, setSeenInitial] = useState(initial);
	if (!unchanged(initial, seenInitial)) {
		setSeenInitial(initial);
		setSaved(initial);
		if (unchanged(values, saved)) setValues(initial);
	}

	const saveMutation = useMutation({
		mutationFn: ({ saver, next }: { saver: Saver<T>; next: T }) => saver(next),
		onMutate: () => {
			toast.loading(`Saving ${title.toLowerCase()} settings…`, { id: toastId });
		},
		onSuccess: (result) => {
			setValues(result.values);
			setSaved(result.values);
			const pending =
				result.status === "saved-action-failed" ||
				result.status === "saved-restart-skipped";
			setNeedsRestart(pending);
			if (pending) {
				toast.warning(result.message, { id: toastId, duration: 10_000 });
			} else {
				toast.success(result.message, { id: toastId });
			}
		},
		onError: (error) => {
			toast.error(errorMessage(error, "These settings could not be saved."), {
				id: toastId,
			});
		},
	});

	const restartMutation = useMutation({
		mutationFn: (restarter: CardRestarter) => restarter(),
		onMutate: () => {
			toast.loading("Restarting BirdNET…", { id: toastId });
		},
		onSuccess: (result) => {
			setNeedsRestart(false);
			toast.success(result.message, { id: toastId });
		},
		onError: (error) => {
			toast.warning(errorMessage(error, "BirdNET could not be restarted."), {
				id: toastId,
				duration: 10_000,
			});
		},
	});

	function write(next: T) {
		if (save) saveMutation.mutate({ saver: save, next });
	}

	async function applyNow() {
		if (restart) await restartMutation.mutateAsync(restart).catch(() => {});
	}

	const saving = saveMutation.isPending || restartMutation.isPending;
	const dirty = !unchanged(values, saved);
	const atDefaults = (current: T) =>
		defaults !== undefined && unchanged({ ...defaults, ...current }, defaults);
	return {
		values,
		setValues,
		submit: () => write(values),
		resetToDefaults: () => {
			if (defaults !== undefined) write(defaults);
		},
		saveDisabled: saving || !dirty,
		resetDisabled: saving || !save || (atDefaults(values) && atDefaults(saved)),
		needsRestart: needsRestart && restart !== undefined,
		applyNow,
	};
}

function restartControl(form: { needsRestart: boolean; applyNow: () => void }) {
	return form.needsRestart ? (
		<RestartButton onRestart={async () => form.applyNow()} />
	) : undefined;
}

function resetControl(
	form: { resetToDefaults: () => void; resetDisabled: boolean },
	description = RESET_RESTARTS_DESCRIPTION,
) {
	return {
		onReset: form.resetToDefaults,
		disabled: form.resetDisabled,
		description,
	};
}

export function Field({
	label,
	hint,
	info,
	readOnly = false,
	children,
}: {
	label: string;
	hint?: ReactNode;
	info?: ReactNode;
	readOnly?: boolean;
	children: ReactNode;
}) {
	const id = useId();
	const hintId = hint ? `${id}-hint` : undefined;
	const field = { id, labelId: `${id}-label`, hintId };
	const Name = readOnly ? "span" : "label";
	return (
		<div className="-mx-page grid gap-x-8 gap-y-2 border-t px-page py-page sm:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] sm:items-center">
			<div className="min-w-0">
				<div className="flex items-center gap-1.5">
					<Name
						id={field.labelId}
						htmlFor={readOnly ? undefined : id}
						className="font-medium text-sm leading-6"
					>
						{label}
					</Name>
					{info ? <InfoTip label={label}>{info}</InfoTip> : null}
				</div>
				{hint ? (
					<div
						id={hintId}
						className="space-y-1 text-muted-foreground text-xs leading-relaxed"
					>
						{hint}
					</div>
				) : null}
			</div>
			<FieldContext.Provider value={field}>
				<div className="min-w-0">{children}</div>
			</FieldContext.Provider>
		</div>
	);
}

const FieldContext = createContext<{
	id: string;
	labelId: string;
	hintId?: string;
}>({ id: "", labelId: "" });

const NO_SPINNER =
	"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function FieldInput({
	unit,
	className = "",
	...props
}: ComponentProps<typeof Input> & { unit?: string }) {
	const { id, hintId } = useContext(FieldContext);
	const numeric = props.type === "number";
	const input = (
		<Input
			id={id}
			aria-describedby={hintId}
			className={`${numeric ? `tabular-nums ${NO_SPINNER}` : ""} ${unit ? (unit.length > 2 ? "pr-20" : "pr-10") : ""} ${className}`}
			{...props}
		/>
	);
	if (!unit) return input;
	return (
		<div className="relative">
			{input}
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-sm"
			>
				{unit}
			</span>
		</div>
	);
}

export function FieldSelect({ children, ...props }: ComponentProps<"select">) {
	const { id, hintId } = useContext(FieldContext);
	return (
		<div className="relative">
			<select
				id={id}
				aria-describedby={hintId}
				className="h-8.5 pointer-coarse:h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-card pr-8 pl-3 pointer-coarse:text-base text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-focus-ring focus-visible:outline-none"
				{...props}
			>
				{children}
			</select>
			<ChevronDown
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
			/>
		</div>
	);
}

export function FieldChoice<T extends string>({
	value,
	options,
	onChange,
}: {
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
}) {
	const { labelId } = useContext(FieldContext);
	return (
		<ToggleGroup
			type="single"
			variant="outline"
			aria-labelledby={labelId}
			className="w-full"
			value={value}
			onValueChange={(next) => {
				if (next) onChange(next as T);
			}}
		>
			{options.map((option) => (
				<ToggleGroupItem
					key={option.value}
					value={option.value}
					className="flex-1"
				>
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}

function numberOr(event: ChangeEvent<HTMLInputElement>, fallback: number) {
	const parsed = event.target.valueAsNumber;
	return Number.isNaN(parsed) ? fallback : parsed;
}

export function SettingsCards({
	tab,
	data,
	savers,
	restarter,
	dataTab = null,
}: {
	tab: SettingsTab;
	data: SettingsPageData;
	savers: SettingsSavers;
	restarter?: SettingsRestarter;
	dataTab?: ReactNode;
}) {
	const restartFor = (card: SettingsCardKind): CardRestarter | undefined =>
		restarter ? () => restarter(card) : undefined;
	const cards: Record<SettingsTab, ReactNode> = {
		detection: (
			<DetectionCard
				initial={data.detection}
				save={savers.detection}
				restart={restartFor("detection")}
			/>
		),
		preferences: (
			<div className="space-y-page">
				<ArtworkSettingsCard
					key={data.artwork.preference}
					initial={data.artwork}
					save={savers.artwork}
				/>
				<PlaybackSettingsCard initial={data.playback} save={savers.playback} />
				<HighlightsSettingsCard
					initial={data.highlights}
					save={savers.highlights}
				/>
				<ReviewSettingsCard initial={data.review} save={savers.review} />
			</div>
		),
		data: dataTab,
	};
	return (
		<>
			{SETTINGS_TABS.map((id) => (
				<div key={id} hidden={id !== tab}>
					{cards[id]}
				</div>
			))}
		</>
	);
}

function DetectionCard({
	initial,
	save,
	restart,
}: {
	initial: DetectionSettings;
	save?: Saver<DetectionSettings>;
	restart?: CardRestarter;
}) {
	const form = useCardSave(
		"Detection",
		initial,
		save,
		restart,
		SETTINGS_DEFAULTS.detection as DetectionSettings,
	);
	return (
		<SettingsCard
			title="Detection"
			description="Tune which model predictions become saved detections, and which sounds are dropped as human."
			onSave={() => void form.submit()}
			reset={resetControl(form)}
			restart={restartControl(form)}
			saveDisabled={form.saveDisabled}
		>
			<Field
				label="Minimum confidence"
				hint="Higher values save fewer, more confident predictions."
			>
				<FieldInput
					type="number"
					min={0.01}
					max={0.99}
					step={0.01}
					required
					value={form.values.confidence}
					onChange={(event) =>
						form.setValues({
							...form.values,
							confidence: numberOr(event, form.values.confidence),
						})
					}
				/>
			</Field>
			<Field
				label="Sensitivity"
				hint="Higher values save fewer detections, not more, while Minimum confidence is above 50%."
				info={
					<>
						Higher values pull every score toward 50% before Minimum confidence
						is applied. A call scoring 88% at 1.0 scores 82% at 1.25 and 73% at
						1.5. Lower it to save more detections, raise it to save fewer.
					</>
				}
			>
				<FieldInput
					type="number"
					min={0.5}
					max={1.5}
					step={0.05}
					required
					value={form.values.sensitivity}
					onChange={(event) =>
						form.setValues({
							...form.values,
							sensitivity: numberOr(event, form.values.sensitivity),
						})
					}
				/>
			</Field>
			<Field
				label="Analysis overlap"
				hint="More overlap improves coverage but uses more compute."
			>
				<FieldInput
					type="number"
					min={0}
					max={2.9}
					step={0.1}
					required
					unit="s"
					value={form.values.overlap}
					onChange={(event) =>
						form.setValues({
							...form.values,
							overlap: numberOr(event, form.values.overlap),
						})
					}
				/>
			</Field>
			<Field
				label="Privacy threshold"
				hint="Speech is filtered even at 0. Higher values catch fainter voices, and drop more birds by mistake."
				info={
					<>
						BirdNET drops a chunk when a human sound is among its top 10 guesses
						for it at 0, its top 60 at 1, and its top 180 at 3. The chunks
						either side are dropped too, so a saved 6-second clip never reaches
						into the speech it found. The live stream is never filtered.
					</>
				}
			>
				<FieldInput
					type="number"
					min={0}
					max={3}
					step={0.1}
					required
					value={form.values.privacyThreshold}
					onChange={(event) =>
						form.setValues({
							...form.values,
							privacyThreshold: numberOr(event, form.values.privacyThreshold),
						})
					}
				/>
			</Field>
		</SettingsCard>
	);
}

function ReviewSettingsCard({
	initial,
	save,
}: {
	initial: ReviewSettings;
	save?: Saver<ReviewSettings>;
}) {
	const form = useCardSave(
		"Review",
		initial,
		save,
		undefined,
		SETTINGS_DEFAULTS.review,
	);
	return (
		<SettingsCard
			title="Review"
			description="Decide which uncommon species the Review page asks you to confirm."
			confirmDescription="This writes the value in this card to the station's configuration. Nothing restarts: the Review queue is judged by it from its next load."
			onSave={() => void form.submit()}
			reset={resetControl(form, RESET_NO_RESTART_DESCRIPTION)}
			saveDisabled={form.saveDisabled}
		>
			<Field
				label="Rare species threshold"
				hint="Species with fewer detections than this, in all, are queued for review."
			>
				<FieldInput
					type="number"
					min={1}
					max={10_000}
					required
					unit="detections"
					value={form.values.rareSpeciesMax}
					onChange={(event) =>
						form.setValues({
							rareSpeciesMax: numberOr(event, form.values.rareSpeciesMax),
						})
					}
				/>
			</Field>
		</SettingsCard>
	);
}

function ArtworkSettingsCard({
	initial,
	save,
}: {
	initial: ArtworkSettings;
	save?: Saver<ArtworkSettings>;
}) {
	const form = useCardSave(
		"Artwork",
		initial,
		save,
		undefined,
		SETTINGS_DEFAULTS.artwork,
	);
	return (
		<SettingsCard
			title="Artwork"
			description="Choose how birds are pictured across the station, for you and anyone visiting."
			confirmDescription="This writes the value in this card to the station's configuration. Nothing restarts: every page uses it right away."
			onSave={() => void form.submit()}
			reset={resetControl(form, RESET_NO_RESTART_DESCRIPTION)}
			saveDisabled={form.saveDisabled}
		>
			<Field
				label="Show birds as"
				hint="A bird with only one of these always shows that one."
			>
				<FieldChoice
					value={form.values.preference}
					options={[
						{ value: "illustrations", label: "Illustrations" },
						{ value: "photos", label: "Photos" },
					]}
					onChange={(preference) => form.setValues({ preference })}
				/>
			</Field>
		</SettingsCard>
	);
}

function PlaybackSettingsCard({
	initial,
	save,
}: {
	initial: PlaybackSettings;
	save?: Saver<PlaybackSettings>;
}) {
	const form = useCardSave(
		"Playback",
		initial,
		save,
		undefined,
		SETTINGS_DEFAULTS.playback,
	);
	return (
		<SettingsCard
			title="Playback"
			description="Choose how recordings sound when played on any page, for you and anyone visiting."
			confirmDescription="This writes the value in this card to the station's configuration. Nothing restarts: the next recording played uses it."
			onSave={() => void form.submit()}
			reset={resetControl(form, RESET_NO_RESTART_DESCRIPTION)}
			saveDisabled={form.saveDisabled}
		>
			<Field
				label="Boost quiet recordings"
				hint="Makes faint, far-off calls louder, and keeps loud ones from distorting. Live audio has its own controls."
			>
				<FieldChoice
					value={form.values.boostQuietRecordings ? "on" : "off"}
					options={[
						{ value: "on", label: "On" },
						{ value: "off", label: "Off" },
					]}
					onChange={(choice) =>
						form.setValues({ boostQuietRecordings: choice === "on" })
					}
				/>
			</Field>
		</SettingsCard>
	);
}

function HighlightsSettingsCard({
	initial,
	save,
}: {
	initial: HighlightSettings;
	save?: Saver<HighlightSettings>;
}) {
	const form = useCardSave(
		"Highlights",
		initial,
		save,
		undefined,
		SETTINGS_DEFAULTS.highlights,
	);
	const number =
		(key: keyof HighlightSettings) => (event: ChangeEvent<HTMLInputElement>) =>
			form.setValues({
				...form.values,
				[key]: numberOr(event, form.values[key]),
			});
	return (
		<SettingsCard
			title="Highlights"
			description="Decide which birds the Highlights card calls out on the Live page and timeline."
			confirmDescription="This writes the values in this card to the station's configuration. Nothing restarts: the Live page and timeline judge by them from their next load."
			onSave={() => void form.submit()}
			reset={resetControl(form, RESET_NO_RESTART_DESCRIPTION)}
			saveDisabled={form.saveDisabled}
		>
			<Field
				label="Rare"
				hint="A bird heard before, with this many records or fewer in all."
			>
				<FieldInput
					type="number"
					min={1}
					max={1000}
					required
					unit="records"
					value={form.values.rareMax}
					onChange={number("rareMax")}
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
					value={form.values.returnedDays}
					onChange={number("returnedDays")}
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
					value={form.values.goneQuietDays}
					onChange={number("goneQuietDays")}
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
					value={form.values.regularDays}
					onChange={number("regularDays")}
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
					value={form.values.vocalRatio}
					onChange={number("vocalRatio")}
				/>
			</Field>
		</SettingsCard>
	);
}

const SkeletonContext = createContext(false);

const SKELETON_DATA: SettingsPageData = {
	...SETTINGS_DEFAULTS,
	station: { siteName: "", latitude: 45, longitude: -75, timezone: "UTC" },
	supportedTimezones: ["UTC"],
	updates: { automatic: true },
};

const SKELETON_VALUES_CLASS =
	"[&_:is(input,select,textarea)]:animate-pulse! [&_:is(input,select,textarea)]:border-transparent! [&_:is(input,select,textarea)]:bg-muted! [&_:is(input,select,textarea)]:bg-none! [&_:is(input,select,textarea)]:text-transparent! [&_:is(input,textarea)::placeholder]:text-transparent! **:data-[slot=toggle-group-item]:animate-pulse! **:data-[slot=toggle-group-item]:border-paper-raised! **:data-[slot=toggle-group-item]:bg-muted! **:data-[slot=toggle-group-item]:text-transparent!";

export function SettingsCardsSkeleton({
	tab,
	dataTab,
}: {
	tab: SettingsTab;
	dataTab?: ReactNode;
}) {
	return (
		<div inert aria-busy="true" className={SKELETON_VALUES_CLASS}>
			<SkeletonContext.Provider value={true}>
				<SettingsCards
					tab={tab}
					data={SKELETON_DATA}
					savers={{}}
					dataTab={dataTab}
				/>
			</SkeletonContext.Provider>
		</div>
	);
}

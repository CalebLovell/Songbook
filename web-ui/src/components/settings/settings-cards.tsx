import { useMutation } from "@tanstack/react-query";
import { ChevronDown, Download, RefreshCw } from "lucide-react";
import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { createContext, useContext, useId, useState } from "react";

import { Button } from "~/components/ui/button.tsx";
import { ConfirmDialog } from "~/components/ui/confirm-dialog.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import { Input } from "~/components/ui/input.tsx";
import { ShellText } from "~/components/ui/shell.tsx";
import { toast } from "~/components/ui/toaster.tsx";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group.tsx";
import { formatDate } from "~/lib/date-format.ts";
import {
	type ArtworkSettings,
	type AudioSettings,
	type DetectionSettings,
	type HighlightSettings,
	type RecordingSettings,
	type ReviewSettings,
	SETTINGS_DEFAULTS,
	type SettingsCardKind,
	type SettingsPageData,
	type SettingsSaveResult,
	type StationSettings,
	type StorageSettings,
	type UpdateSettings,
} from "~/lib/settings-data.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";
import { modernTimezone } from "~/lib/timezones.ts";
import {
	availableUpdate,
	type UpdateState,
	updateBusy,
} from "~/lib/updates-data.ts";
import { useClientValue } from "~/lib/use-client-value.ts";
import { errorMessage } from "~/lib/utils.ts";
import { RestartButton } from "./restart-button.tsx";
import { RESET_RESTARTS_DESCRIPTION, SettingsCard } from "./settings-card.tsx";
import { SETTINGS_TABS, type SettingsTab } from "./settings-index.ts";
import { StationLocation } from "./station-location.tsx";

const RESET_NO_RESTART_DESCRIPTION =
	"Every value in this card goes back to what a fresh install writes, and any edits you haven't saved are dropped. Nothing restarts. Other cards are left as they are.";

type Saver<T> = (values: T) => Promise<SettingsSaveResult<T>>;
type CardRestarter = () => Promise<{ message: string }>;

export type SettingsSavers = {
	station?: Saver<StationSettings>;
	detection?: Saver<DetectionSettings>;
	audio?: Saver<AudioSettings>;
	recording?: Saver<RecordingSettings>;
	storage?: Saver<StorageSettings>;
	review?: Saver<ReviewSettings>;
	highlights?: Saver<HighlightSettings>;
	artwork?: Saver<ArtworkSettings>;
	updates?: Saver<UpdateSettings>;
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

function Field({
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

function FieldSelect({ children, ...props }: ComponentProps<"select">) {
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

function FieldChoice<T extends string>({
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
	diskUsedPercent = null,
	updates = null,
	onCheckUpdates,
	onInstallUpdate,
}: {
	tab: SettingsTab;
	data: SettingsPageData;
	savers: SettingsSavers;
	restarter?: SettingsRestarter;
	diskUsedPercent?: number | null;
	updates?: UpdateState | null;
	onCheckUpdates?: () => Promise<UpdateState>;
	onInstallUpdate?: () => Promise<void>;
}) {
	const restartFor = (card: SettingsCardKind): CardRestarter | undefined =>
		restarter ? () => restarter(card) : undefined;
	const cards: Record<SettingsTab, ReactNode> = {
		station: (
			<StationCard
				initial={data.station}
				timezones={data.supportedTimezones}
				save={savers.station}
				restart={restartFor("station")}
			/>
		),
		detection: (
			<DetectionCard
				initial={data.detection}
				save={savers.detection}
				restart={restartFor("detection")}
			/>
		),
		"audio-input": (
			<AudioCard
				initial={data.audio}
				save={savers.audio}
				restart={restartFor("audio")}
			/>
		),
		recording: (
			<RecordingCard
				initial={data.recording}
				save={savers.recording}
				restart={restartFor("recording")}
			/>
		),
		storage: (
			<StorageCard
				initial={data.storage}
				save={savers.storage}
				restart={restartFor("storage")}
				diskUsedPercent={diskUsedPercent}
			/>
		),
		updates: (
			<UpdatesSettingsCard
				initial={data.updates}
				save={savers.updates}
				updates={updates}
				onCheck={onCheckUpdates}
				onInstall={onInstallUpdate}
			/>
		),
		preferences: (
			<div className="space-y-page">
				<ArtworkSettingsCard
					key={data.artwork.preference}
					initial={data.artwork}
					save={savers.artwork}
				/>
				<HighlightsSettingsCard
					initial={data.highlights}
					save={savers.highlights}
				/>
				<ReviewSettingsCard initial={data.review} save={savers.review} />
			</div>
		),
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

function StationCard({
	initial,
	timezones,
	save,
	restart,
}: {
	initial: StationSettings;
	timezones: string[];
	save?: Saver<StationSettings>;
	restart?: CardRestarter;
}) {
	const form = useCardSave("Station", initial, save, restart);
	return (
		<SettingsCard
			title="Station"
			description="Name the station and locate it for geographic species filtering."
			onSave={() => void form.submit()}
			restart={restartControl(form)}
			saveDisabled={form.saveDisabled}
		>
			<Field label="Station name" hint="What this station is called.">
				<FieldInput
					value={form.values.siteName}
					maxLength={80}
					onChange={(event) =>
						form.setValues({ ...form.values, siteName: event.target.value })
					}
				/>
			</Field>
			<Field label="Latitude" hint="Decimal degrees, north positive.">
				<FieldInput
					type="number"
					min={-90}
					max={90}
					step="any"
					required
					unit="°"
					value={form.values.latitude}
					onChange={(event) =>
						form.setValues({
							...form.values,
							latitude: numberOr(event, form.values.latitude),
						})
					}
				/>
			</Field>
			<Field label="Longitude" hint="Decimal degrees, east positive.">
				<FieldInput
					type="number"
					min={-180}
					max={180}
					step="any"
					required
					unit="°"
					value={form.values.longitude}
					onChange={(event) =>
						form.setValues({
							...form.values,
							longitude: numberOr(event, form.values.longitude),
						})
					}
				/>
			</Field>
			<Field
				label="Your location"
				readOnly
				hint="Fill the latitude and longitude from this device's location."
			>
				<StationLocation
					current={{
						latitude: form.values.latitude,
						longitude: form.values.longitude,
					}}
					onApply={(coordinates) =>
						form.setValues({ ...form.values, ...coordinates })
					}
				/>
			</Field>
			<Field
				label="Timezone"
				hint={
					<>
						<p>
							Type to search, e.g. “New York”. Also sets the station's
							operating-system clock.
						</p>
						<BrowserTimezoneHint
							timezone={form.values.timezone}
							onUse={(timezone) => form.setValues({ ...form.values, timezone })}
						/>
					</>
				}
			>
				<FieldInput
					list="station-timezones"
					autoComplete="off"
					spellCheck={false}
					value={form.values.timezone}
					onChange={(event) =>
						form.setValues({ ...form.values, timezone: event.target.value })
					}
				/>
				<datalist id="station-timezones">
					{timezones.map((timezone) => (
						<option key={timezone} value={timezone} />
					))}
				</datalist>
			</Field>
		</SettingsCard>
	);
}

function BrowserTimezoneHint({
	timezone,
	onUse,
}: {
	timezone: string;
	onUse: (timezone: string) => void;
}) {
	const skeleton = useContext(SkeletonContext);
	const browserTimezone = useClientValue<string | null>(
		() => modernTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone),
		null,
	);

	if (
		skeleton ||
		!browserTimezone ||
		modernTimezone(timezone) === browserTimezone
	) {
		return null;
	}
	return (
		<p>
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
				hint="How readily the model scores a sound as a bird."
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
				label="Species-frequency threshold"
				hint="Narrows candidates using location and season."
				info={
					<>
						How common a species must be near you before BirdNET will consider
						it at all. The score behind this is roughly how often birders in
						your area report that bird this week, so even an everyday yard bird
						can sit well below 1.0. The 0.03 default is deliberately permissive.
						Lower it to catch more species, raise it to cut false positives.
						Species on Always detect skip this check entirely.
					</>
				}
			>
				<FieldInput
					type="number"
					min={0.0005}
					max={0.99}
					step={0.0005}
					required
					value={form.values.speciesFrequencyThreshold}
					onChange={(event) =>
						form.setValues({
							...form.values,
							speciesFrequencyThreshold: numberOr(
								event,
								form.values.speciesFrequencyThreshold,
							),
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
						either side are dropped too. Saved clips longer than 9 seconds can
						still reach past them into speech, and the live stream is never
						filtered.
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

function AudioCard({
	initial,
	save,
	restart,
}: {
	initial: AudioSettings;
	save?: Saver<AudioSettings>;
	restart?: CardRestarter;
}) {
	const form = useCardSave(
		"Audio input",
		initial,
		save,
		restart,
		SETTINGS_DEFAULTS.audio as AudioSettings,
	);
	const streams = form.values.rtspStreams.filter(Boolean);
	return (
		<SettingsCard
			title="Audio input"
			description="Choose a local microphone or one or more network audio streams."
			onSave={() => void form.submit()}
			reset={resetControl(
				form,
				`${RESET_RESTARTS_DESCRIPTION} Any RTSP streams you have configured are cleared and the station returns to microphone input.`,
			)}
			restart={restartControl(form)}
			saveDisabled={form.saveDisabled}
		>
			<Field label="Input" hint="Where the station listens from.">
				<FieldChoice
					value={form.values.mode}
					options={[
						{ value: "microphone", label: "Microphone" },
						{ value: "rtsp", label: "RTSP stream" },
					]}
					onChange={(mode) => form.setValues({ ...form.values, mode })}
				/>
			</Field>
			{form.values.mode === "microphone" ? (
				<>
					<Field
						label="Recording device"
						hint="ALSA or PulseAudio device identifier."
					>
						<FieldInput
							required
							className="font-mono"
							value={form.values.recordingDevice}
							placeholder="default"
							onChange={(event) =>
								form.setValues({
									...form.values,
									recordingDevice: event.target.value,
								})
							}
						/>
					</Field>
					<Field label="Channels" hint="Channels captured from the device.">
						<FieldInput
							type="number"
							min={1}
							max={32}
							required
							value={form.values.channels}
							onChange={(event) =>
								form.setValues({
									...form.values,
									channels: numberOr(event, form.values.channels),
								})
							}
						/>
					</Field>
				</>
			) : (
				<>
					<Field
						label="RTSP streams"
						hint="One rtsp:// or rtsps:// URL per line. Credentials stay in the station configuration."
					>
						<FieldTextarea
							required
							value={form.values.rtspStreams.join("\n")}
							onChange={(event) => {
								const rtspStreams = event.target.value.split(/\r?\n/);
								form.setValues({
									...form.values,
									rtspStreams,
									livestreamIndex: Math.min(
										form.values.livestreamIndex,
										Math.max(0, rtspStreams.filter(Boolean).length - 1),
									),
								});
							}}
						/>
					</Field>
					{streams.length > 1 ? (
						<Field
							label="Live-player stream"
							hint="The stream the live player plays."
						>
							<FieldSelect
								value={form.values.livestreamIndex}
								onChange={(event) =>
									form.setValues({
										...form.values,
										livestreamIndex: Number(event.target.value),
									})
								}
							>
								{streams.map((stream, index) => (
									<option key={stream} value={index}>
										Stream {index + 1}
									</option>
								))}
							</FieldSelect>
						</Field>
					) : null}
				</>
			)}
		</SettingsCard>
	);
}

function FieldTextarea(props: ComponentProps<"textarea">) {
	const { id, hintId } = useContext(FieldContext);
	return (
		<textarea
			id={id}
			aria-describedby={hintId}
			className="block min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-xs transition-colors placeholder:text-muted-foreground focus-visible:border-focus-ring focus-visible:outline-none"
			{...props}
		/>
	);
}

function RecordingCard({
	initial,
	save,
	restart,
}: {
	initial: RecordingSettings;
	save?: Saver<RecordingSettings>;
	restart?: CardRestarter;
}) {
	const form = useCardSave(
		"Recording",
		initial,
		save,
		restart,
		SETTINGS_DEFAULTS.recording as RecordingSettings,
	);
	return (
		<SettingsCard
			title="Recording"
			description="Control capture duration and the files retained for playback."
			onSave={() => void form.submit()}
			reset={resetControl(form)}
			restart={restartControl(form)}
			saveDisabled={form.saveDisabled}
		>
			<Field
				label="Recording length"
				hint="Audio captured per analyzed recording."
			>
				<FieldInput
					type="number"
					min={3}
					max={60}
					required
					unit="s"
					value={form.values.recordingLength}
					onChange={(event) =>
						form.setValues({
							...form.values,
							recordingLength: numberOr(event, form.values.recordingLength),
						})
					}
				/>
			</Field>
			<Field
				label="Extraction length"
				hint="Length of each saved clip. Leave blank for the backend default."
			>
				<FieldInput
					type="number"
					min={3}
					max={form.values.recordingLength}
					unit="s"
					value={form.values.extractionLength ?? ""}
					onChange={(event) =>
						form.setValues({
							...form.values,
							extractionLength: Number.isNaN(event.target.valueAsNumber)
								? null
								: event.target.valueAsNumber,
						})
					}
				/>
			</Field>
			<Field label="Audio format" hint="File type for saved clips.">
				<FieldSelect
					value={form.values.audioFormat}
					onChange={(event) =>
						form.setValues({
							...form.values,
							audioFormat: event.target
								.value as RecordingSettings["audioFormat"],
						})
					}
				>
					<option value="mp3">MP3</option>
					<option value="wav">WAV</option>
					<option value="flac">FLAC</option>
					<option value="ogg">Ogg Vorbis</option>
				</FieldSelect>
			</Field>
		</SettingsCard>
	);
}

function StorageCard({
	initial,
	save,
	restart,
	diskUsedPercent,
}: {
	initial: StorageSettings;
	save?: Saver<StorageSettings>;
	restart?: CardRestarter;
	diskUsedPercent: number | null;
}) {
	const form = useCardSave(
		"Storage",
		initial,
		save,
		restart,
		SETTINGS_DEFAULTS.storage as StorageSettings,
	);
	return (
		<SettingsCard
			title="Storage"
			description="Decide what happens as the station fills its disk."
			onSave={() => void form.submit()}
			reset={resetControl(form)}
			restart={restartControl(form)}
			saveDisabled={form.saveDisabled}
		>
			<Field
				label="When the disk fills"
				hint={
					form.values.fullDiskAction === "purge"
						? "Removes the least confident recordings once the threshold is crossed. Detections stay."
						: "Stops core services when space runs out instead of deleting recordings."
				}
			>
				<FieldChoice
					value={form.values.fullDiskAction}
					options={[
						{ value: "purge", label: "Purge old data" },
						{ value: "keep", label: "Keep all data" },
					]}
					onChange={(fullDiskAction) =>
						form.setValues({ ...form.values, fullDiskAction })
					}
				/>
			</Field>
			<Field
				label="Disk-used threshold"
				hint={
					diskUsedPercent === null
						? "How full the disk gets before that action runs."
						: `How full the disk gets before that action runs. It is ${Math.round(diskUsedPercent)}% full now.`
				}
			>
				<FieldInput
					type="number"
					min={20}
					max={99}
					required
					unit="%"
					value={form.values.purgeThreshold}
					onChange={(event) =>
						form.setValues({
							...form.values,
							purgeThreshold: numberOr(event, form.values.purgeThreshold),
						})
					}
				/>
			</Field>
			<Field
				label="Recordings always kept per species"
				hint="A purge never takes a species below its most confident recordings."
			>
				<FieldInput
					type="number"
					min={0}
					required
					value={form.values.keepPerSpecies}
					onChange={(event) =>
						form.setValues({
							...form.values,
							keepPerSpecies: numberOr(event, form.values.keepPerSpecies),
						})
					}
				/>
			</Field>
			<Field
				label="Maximum files per species"
				hint="0 keeps every recording, subject to disk-full handling."
			>
				<FieldInput
					type="number"
					min={0}
					required
					value={form.values.maxFilesPerSpecies}
					onChange={(event) =>
						form.setValues({
							...form.values,
							maxFilesPerSpecies: numberOr(
								event,
								form.values.maxFilesPerSpecies,
							),
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

function ago(iso: string) {
	return formatTimeAgo(Date.now() - new Date(iso).getTime());
}

function UpdatesSettingsCard({
	initial,
	save,
	updates,
	onCheck,
	onInstall,
}: {
	initial: UpdateSettings;
	save?: Saver<UpdateSettings>;
	updates: UpdateState | null;
	onCheck?: () => Promise<UpdateState>;
	onInstall?: () => Promise<void>;
}) {
	const form = useCardSave("Updates", initial, save);
	const [confirming, setConfirming] = useState(false);
	const [loadedVersion, setLoadedVersion] = useState<string | null>(null);
	const installed = updates?.installed ?? null;
	if (installed && loadedVersion === null) setLoadedVersion(installed.version);
	const managed = updates?.managed ?? false;
	const busy = updates ? updateBusy(updates) : false;
	const offered = updates ? availableUpdate(updates) : null;
	const reloadable =
		loadedVersion !== null &&
		installed !== null &&
		installed.version !== loadedVersion;

	const checkMutation = useMutation({
		mutationFn: (runCheck: () => Promise<UpdateState>) => runCheck(),
		onSuccess: (result) => {
			if (result.state === "failed")
				toast.error(result.message ?? "Couldn't look for updates.", {
					id: "settings-updates",
				});
			else
				toast.success(
					result.message ??
						(availableUpdate(result)
							? "An update is available."
							: "Up to date."),
					{ id: "settings-updates" },
				);
		},
		onError: (error) => {
			toast.error(errorMessage(error, "Couldn't look for updates."), {
				id: "settings-updates",
			});
		},
	});
	const checking = checkMutation.isPending;

	async function run(
		action: (() => Promise<void>) | undefined,
		failure: string,
	) {
		if (!action) return;
		try {
			await action();
		} catch (error) {
			toast.error(errorMessage(error, failure), {
				id: "settings-updates",
			});
		}
	}

	function check() {
		if (onCheck) checkMutation.mutate(onCheck);
	}

	return (
		<SettingsCard
			title="Updates"
			description="Keep this station on the newest release of Songbook."
			confirmDescription="This writes the values in this card to the station's configuration. Nothing restarts."
			onSave={() => void form.submit()}
			saveDisabled={form.saveDisabled}
		>
			<Field
				label="This station"
				readOnly
				hint={
					updates === null ? (
						<ShellText className="text-xs" barClassName="w-40" />
					) : !managed ? (
						"Not installed from a release, so the updater leaves it alone."
					) : reloadable ? (
						<p>
							Updated.{" "}
							<button
								type="button"
								onClick={() => window.location.reload()}
								className="font-medium text-moss underline underline-offset-2"
							>
								Reload to use it
							</button>
						</p>
					) : installed?.installedAt ? (
						`Installed ${formatDate(installed.installedAt)}.`
					) : null
				}
			>
				{updates === null ? (
					<ShellText className="text-sm leading-9" barClassName="w-24" />
				) : (
					<p className="text-sm leading-9">
						{!managed ? (
							"Development copy"
						) : (
							<span className="tabular-nums">
								{installed?.version ?? "Unknown"}
							</span>
						)}
					</p>
				)}
			</Field>
			<Field
				label="Newest release"
				readOnly
				hint={
					updates === null ? (
						<ShellText className="text-xs" barClassName="w-48" />
					) : updates.state === "failed" && updates.message ? (
						<span className="text-destructive">{updates.message}</span>
					) : updates.state === "updating" ? (
						"Recording stops for about a minute while it installs, and this page comes back when the station does."
					) : updates.checkedAt ? (
						`Checked ${ago(updates.checkedAt)}.`
					) : managed ? (
						"Checked nightly, or when you press Check."
					) : (
						"Only an installed station looks for releases."
					)
				}
			>
				{updates === null ? (
					<ShellText className="text-sm leading-9" barClassName="w-28" />
				) : updates.state === "updating" ? (
					<p className="text-sm leading-9">
						Installing{" "}
						<span className="tabular-nums">{updates.target ?? "update"}</span>…
					</p>
				) : offered ? (
					<Button
						type="button"
						size="default"
						icon={Download}
						disabled={busy || !onInstall}
						onClick={() => setConfirming(true)}
					>
						Update to {offered}
					</Button>
				) : (
					<p className="text-sm leading-9">
						{updates.latest
							? "Up to date"
							: managed
								? "Not checked yet"
								: "Not available"}
					</p>
				)}
			</Field>
			<Field
				label="Check for updates"
				readOnly
				hint="Ask GitHub for the newest release now instead of waiting for tonight's check."
			>
				<Button
					type="button"
					variant="outline"
					size="default"
					icon={RefreshCw}
					loading={checking || updates?.state === "checking"}
					disabled={!managed || busy || !onCheck}
					onClick={() => void check()}
				>
					{checking ? "Checking…" : "Check"}
				</Button>
			</Field>
			<Field
				label="Automatic updates"
				hint="Installs new releases by itself overnight, between 3 and 5 AM. Off, they wait for you to press Update."
			>
				<FieldChoice
					value={form.values.automatic ? "on" : "off"}
					options={[
						{ value: "on", label: "On" },
						{ value: "off", label: "Off" },
					]}
					onChange={(choice) => form.setValues({ automatic: choice === "on" })}
				/>
			</Field>

			{confirming && offered ? (
				<ConfirmDialog
					title={`Update to ${offered}?`}
					description="The station installs the new release and restarts. Recording stops for about a minute, and this page comes back when the station does. If the new version doesn't start, the station goes back to the one it has now."
					confirmLabel="Update now"
					confirmIcon={Download}
					onCancel={() => setConfirming(false)}
					onConfirm={() => {
						setConfirming(false);
						void run(onInstall, "Couldn't start the update.");
					}}
				/>
			) : null}
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

export function SettingsCardsSkeleton({ tab }: { tab: SettingsTab }) {
	return (
		<div inert aria-busy="true" className={SKELETON_VALUES_CLASS}>
			<SkeletonContext.Provider value={true}>
				<SettingsCards tab={tab} data={SKELETON_DATA} savers={{}} />
			</SkeletonContext.Provider>
		</div>
	);
}

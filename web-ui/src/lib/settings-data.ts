import { z } from "zod";

import { HIGHLIGHT_THRESHOLDS } from "~/lib/highlight-thresholds.ts";
import {
	ARTWORK_PREFERENCES,
	DEFAULT_ARTWORK_PREFERENCE,
} from "~/lib/illustrations.ts";
import { isKnownTimezone } from "~/lib/timezones.ts";

export const DEFAULT_REVIEW_RARE_SPECIES_MAX = 10;

const hasNoControlCharacters = (value: string) =>
	[...value].every((character) => {
		const code = character.charCodeAt(0);
		return code > 31 && code !== 127;
	});
const safeText = (maximum: number) =>
	z
		.string()
		.trim()
		.max(maximum)
		.refine(hasNoControlCharacters, "Control characters are not allowed");

export const stationSettingsSchema = z.object({
	siteName: safeText(80),
	latitude: z.number().finite().min(-90).max(90),
	longitude: z.number().finite().min(-180).max(180),
	timezone: z
		.string()
		.trim()
		.refine(isKnownTimezone, "Pick a timezone from the list"),
});

export const detectionSettingsSchema = z.object({
	speciesFrequencyThreshold: z.number().finite().min(0.0005).max(0.99),
	confidence: z.number().finite().min(0.01).max(0.99),
	sensitivity: z.number().finite().min(0.5).max(1.5),
	overlap: z.number().finite().min(0).max(2.9),
	privacyThreshold: z.number().finite().min(0).max(3),
});

const rtspStreamSchema = z
	.string()
	.trim()
	.url()
	.refine((value) => {
		const protocol = new URL(value).protocol;
		return protocol === "rtsp:" || protocol === "rtsps:";
	}, "Use an rtsp:// or rtsps:// URL");

const rtspStreamsSchema = z.preprocess((value) => {
	const lines = typeof value === "string" ? value.split(/\r?\n/) : value;
	if (!Array.isArray(lines)) return value;
	return lines
		.map((line) => (typeof line === "string" ? line.trim() : line))
		.filter((line) => line !== "");
}, z.array(rtspStreamSchema));

export const audioSettingsSchema = z
	.object({
		mode: z.enum(["microphone", "rtsp"]),
		recordingDevice: safeText(200),
		channels: z.number().int().min(1).max(32),
		rtspStreams: rtspStreamsSchema,
		livestreamIndex: z.number().int().min(0),
	})
	.superRefine((value, context) => {
		if (value.mode === "microphone" && value.recordingDevice.length === 0) {
			context.addIssue({
				code: "custom",
				path: ["recordingDevice"],
				message: "A recording device is required in microphone mode",
			});
		}
		if (value.mode === "rtsp" && value.rtspStreams.length === 0) {
			context.addIssue({
				code: "custom",
				path: ["rtspStreams"],
				message: "Add at least one RTSP stream",
			});
		}
		if (
			value.mode === "rtsp" &&
			value.livestreamIndex >= value.rtspStreams.length
		) {
			context.addIssue({
				code: "custom",
				path: ["livestreamIndex"],
				message: "Select a configured live stream",
			});
		}
	});

export const recordingSettingsSchema = z
	.object({
		recordingLength: z.number().int().min(3).max(60),
		extractionLength: z.number().int().min(3).max(60).nullable(),
		audioFormat: z.enum(["mp3", "wav", "flac", "ogg"]),
	})
	.superRefine((value, context) => {
		if (
			value.extractionLength !== null &&
			value.extractionLength > value.recordingLength
		) {
			context.addIssue({
				code: "custom",
				path: ["extractionLength"],
				message: "Extraction length cannot exceed recording length",
			});
		}
	});

export const storageSettingsSchema = z.object({
	fullDiskAction: z.enum(["purge", "keep"]),
	purgeThreshold: z.number().int().min(20).max(99),
	maxFilesPerSpecies: z.number().int().min(0),
	keepPerSpecies: z.number().int().min(0),
});

export const reviewSettingsSchema = z.object({
	rareSpeciesMax: z
		.number()
		.int()
		.min(1)
		.max(10_000)
		.default(DEFAULT_REVIEW_RARE_SPECIES_MAX),
});

export const highlightSettingsSchema = z.object({
	rareMax: z.number().int().min(1).max(1000),
	returnedDays: z.number().int().min(2).max(90),
	goneQuietDays: z.number().int().min(2).max(90),
	regularDays: z.number().int().min(2).max(90),
	vocalRatio: z.number().finite().min(1.5).max(20),
});

export const artworkSettingsSchema = z.object({
	preference: z.enum(ARTWORK_PREFERENCES),
});

export const updateSettingsSchema = z.object({ automatic: z.boolean() });

export type StationSettings = z.infer<typeof stationSettingsSchema>;
export type DetectionSettings = z.infer<typeof detectionSettingsSchema>;
export type AudioSettings = z.infer<typeof audioSettingsSchema>;
export type RecordingSettings = z.infer<typeof recordingSettingsSchema>;
export type StorageSettings = z.infer<typeof storageSettingsSchema>;
export type ReviewSettings = z.infer<typeof reviewSettingsSchema>;
export type HighlightSettings = z.infer<typeof highlightSettingsSchema>;
export type ArtworkSettings = z.infer<typeof artworkSettingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

export type SettingsCardKind =
	| "station"
	| "detection"
	| "audio"
	| "recording"
	| "storage"
	| "review"
	| "highlights"
	| "artwork"
	| "updates";

export type SettingsByKind = {
	station: StationSettings;
	detection: DetectionSettings;
	audio: AudioSettings;
	recording: RecordingSettings;
	storage: StorageSettings;
	review: ReviewSettings;
	highlights: HighlightSettings;
	artwork: ArtworkSettings;
	updates: UpdateSettings;
};

export type SettingsPageData = SettingsByKind & {
	supportedTimezones: string[];
};

export const SETTINGS_DEFAULTS = {
	detection: {
		speciesFrequencyThreshold: 0.03,
		confidence: 0.7,
		sensitivity: 1.25,
		overlap: 0,
		privacyThreshold: 0,
	},
	audio: {
		mode: "microphone",
		recordingDevice: "default",
		channels: 2,
		rtspStreams: [],
		livestreamIndex: 0,
	},
	recording: {
		recordingLength: 15,
		extractionLength: null,
		audioFormat: "mp3",
	},
	storage: {
		fullDiskAction: "purge",
		purgeThreshold: 95,
		maxFilesPerSpecies: 0,
		keepPerSpecies: 10,
	},
	review: { rareSpeciesMax: DEFAULT_REVIEW_RARE_SPECIES_MAX },
	highlights: {
		rareMax: HIGHLIGHT_THRESHOLDS.rareMax,
		returnedDays: HIGHLIGHT_THRESHOLDS.returned.days,
		goneQuietDays: HIGHLIGHT_THRESHOLDS.goneQuiet.days,
		regularDays: HIGHLIGHT_THRESHOLDS.consistent.streakDays,
		vocalRatio: HIGHLIGHT_THRESHOLDS.vocal.ratio,
	},
	artwork: { preference: DEFAULT_ARTWORK_PREFERENCE },
} satisfies Omit<SettingsByKind, "station" | "updates">;

export const RESETTABLE_CARDS = [
	"detection",
	"audio",
	"recording",
	"storage",
	"review",
	"highlights",
	"artwork",
] as const satisfies readonly Exclude<
	SettingsCardKind,
	"station" | "updates"
>[];

export type SettingsSaveResult<T> = {
	status: "saved" | "saved-restart-skipped" | "saved-action-failed";
	values: T;
	message: string;
};

const schemas = {
	station: stationSettingsSchema,
	detection: detectionSettingsSchema,
	audio: audioSettingsSchema,
	recording: recordingSettingsSchema,
	storage: storageSettingsSchema,
	review: reviewSettingsSchema,
	highlights: highlightSettingsSchema,
	artwork: artworkSettingsSchema,
	updates: updateSettingsSchema,
} as const;

export function parseSettingsCard<K extends SettingsCardKind>(
	kind: K,
	input: unknown,
): SettingsByKind[K] {
	return schemas[kind].parse(input) as SettingsByKind[K];
}

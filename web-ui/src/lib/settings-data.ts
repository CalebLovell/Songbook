import { z } from "zod";

import { HIGHLIGHT_THRESHOLDS } from "~/lib/highlight-thresholds.ts";
import {
	ARTWORK_PREFERENCES,
	DEFAULT_ARTWORK_PREFERENCE,
} from "~/lib/illustrations.ts";
import { isKnownTimezone } from "~/lib/timezones.ts";

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
	locationConfirmed: z.boolean().optional(),
});

export const detectionSettingsSchema = z.object({
	confidence: z.number().finite().min(0.01).max(0.99),
	sensitivity: z.number().finite().min(0.5).max(1.5),
	overlap: z.number().finite().min(0).max(2.9),
	privacyThreshold: z.number().finite().min(0).max(3),
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

export const playbackSettingsSchema = z.object({
	boostQuietRecordings: z.boolean(),
});

export const updateSettingsSchema = z.object({ automatic: z.boolean() });

export type StationSettings = z.infer<typeof stationSettingsSchema>;
export type DetectionSettings = z.infer<typeof detectionSettingsSchema>;
export type HighlightSettings = z.infer<typeof highlightSettingsSchema>;
export type ArtworkSettings = z.infer<typeof artworkSettingsSchema>;
export type PlaybackSettings = z.infer<typeof playbackSettingsSchema>;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

export type SettingsCardKind =
	| "station"
	| "detection"
	| "highlights"
	| "artwork"
	| "playback"
	| "updates";

export type SettingsByKind = {
	station: StationSettings;
	detection: DetectionSettings;
	highlights: HighlightSettings;
	artwork: ArtworkSettings;
	playback: PlaybackSettings;
	updates: UpdateSettings;
};

export type SettingsPageData = SettingsByKind & {
	supportedTimezones: string[];
};

export const SETTINGS_DEFAULTS = {
	detection: {
		confidence: 0.7,
		sensitivity: 1.25,
		overlap: 0,
		privacyThreshold: 0,
	},
	highlights: {
		rareMax: HIGHLIGHT_THRESHOLDS.rareMax,
		returnedDays: HIGHLIGHT_THRESHOLDS.returned.days,
		goneQuietDays: HIGHLIGHT_THRESHOLDS.goneQuiet.days,
		regularDays: HIGHLIGHT_THRESHOLDS.consistent.streakDays,
		vocalRatio: HIGHLIGHT_THRESHOLDS.vocal.ratio,
	},
	artwork: { preference: DEFAULT_ARTWORK_PREFERENCE },
	playback: { boostQuietRecordings: true },
	updates: { automatic: true },
} satisfies Omit<SettingsByKind, "station">;

export const preferencesSchema = z.object({
	artwork: artworkSettingsSchema,
	playback: playbackSettingsSchema,
	highlights: highlightSettingsSchema,
});

export type PreferenceSettings = z.infer<typeof preferencesSchema>;

export const PREFERENCE_CARDS = [
	"artwork",
	"playback",
	"highlights",
] as const satisfies readonly (keyof PreferenceSettings & SettingsCardKind)[];

export const PREFERENCE_DEFAULTS: PreferenceSettings = {
	artwork: SETTINGS_DEFAULTS.artwork,
	playback: SETTINGS_DEFAULTS.playback,
	highlights: SETTINGS_DEFAULTS.highlights,
};

export type SettingsSaveResult<T> = {
	status: "saved" | "saved-restart-skipped" | "saved-action-failed";
	values: T;
	message: string;
};

const schemas = {
	station: stationSettingsSchema,
	detection: detectionSettingsSchema,
	highlights: highlightSettingsSchema,
	artwork: artworkSettingsSchema,
	playback: playbackSettingsSchema,
	updates: updateSettingsSchema,
} as const;

export function parseSettingsCard<K extends SettingsCardKind>(
	kind: K,
	input: unknown,
): SettingsByKind[K] {
	return schemas[kind].parse(input) as SettingsByKind[K];
}

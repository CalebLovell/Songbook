import "@tanstack/react-start/server-only";

import { readFile } from "node:fs/promises";

import { timezoneOptions } from "~/lib/timezones.ts";

import {
	readSettingsPageValues,
	resolveSettingsPath,
	writeSettingsCard,
} from "./settings-config.server.ts";
import {
	type ArtworkSettings,
	type DetectionSettings,
	type HighlightSettings,
	type PlaybackSettings,
	PREFERENCE_CARDS,
	PREFERENCE_DEFAULTS,
	type PreferenceSettings,
	parseSettingsCard,
	preferencesSchema,
	type SettingsByKind,
	type SettingsCardKind,
	type SettingsPageData,
	type SettingsSaveResult,
	type StationSettings,
	type UpdateSettings,
} from "./settings-data.ts";
import {
	restartServices,
	runCardSystemActions,
	type SettingsCommandRunner,
} from "./settings-system.server.ts";

export type SettingsServerDependencies = {
	settingsPath?: string;
	currentTimezone?: string;
	timezoneFileExists?: boolean;
	skipSystemActions?: boolean;
	runner?: SettingsCommandRunner;
};

export async function currentTimezone() {
	try {
		const configured = (await readFile("/etc/timezone", "utf8")).trim();
		if (configured) return configured;
	} catch {}
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export async function loadSettingsPageData(
	dependencies: SettingsServerDependencies = {},
): Promise<SettingsPageData> {
	try {
		const timezone = dependencies.currentTimezone ?? (await currentTimezone());
		const settings = await readSettingsPageValues(
			dependencies.settingsPath ?? resolveSettingsPath(),
			timezone,
		);
		return {
			...settings,
			supportedTimezones: timezoneOptions(),
		};
	} catch {
		throw new Error("BirdNET settings are unavailable.");
	}
}

const SAVED_NEEDS_RESTART = "Saved. Restart BirdNET for this to take effect.";

async function saveSettings<K extends SettingsCardKind>(
	kind: K,
	input: SettingsByKind[K],
	dependencies: SettingsServerDependencies,
): Promise<SettingsSaveResult<SettingsByKind[K]>> {
	const values = parseSettingsCard(kind, input);
	let previousTimezone: string | undefined;
	if (kind === "station")
		previousTimezone =
			dependencies.currentTimezone ?? (await currentTimezone());
	try {
		await writeSettingsCard(
			kind,
			values,
			dependencies.settingsPath ?? resolveSettingsPath(),
		);
	} catch (error) {
		console.error(`[settings] saving ${kind} failed:`, error);
		throw new Error("Settings could not be saved.");
	}
	try {
		const action = await runCardSystemActions(
			kind,
			{
				previousTimezone,
				timezone:
					kind === "station"
						? (values as SettingsByKind["station"]).timezone
						: undefined,
				timezoneFileExists: dependencies.timezoneFileExists,
				skipSystemActions: dependencies.skipSystemActions,
			},
			dependencies.runner,
		);
		return action.skipped
			? {
					status: "saved-restart-skipped",
					values,
					message: SAVED_NEEDS_RESTART,
				}
			: {
					status: "saved",
					values,
					message: action.attempted ? "Saved and now in effect." : "Saved.",
				};
	} catch {
		return {
			status: "saved-action-failed",
			values,
			message: SAVED_NEEDS_RESTART,
		};
	}
}

export function saveStationSettings(
	input: StationSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("station", input, dependencies);
}

export function saveDetectionSettings(
	input: DetectionSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("detection", input, dependencies);
}

export function saveUpdateSettings(
	input: UpdateSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("updates", input, dependencies);
}

export function saveHighlightSettings(
	input: HighlightSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("highlights", input, dependencies);
}

export function saveArtworkSettings(
	input: ArtworkSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("artwork", input, dependencies);
}

export function savePlaybackSettings(
	input: PlaybackSettings,
	dependencies: SettingsServerDependencies = {},
) {
	return saveSettings("playback", input, dependencies);
}

export async function savePreferences(
	input: PreferenceSettings,
	dependencies: SettingsServerDependencies = {},
): Promise<SettingsSaveResult<PreferenceSettings>> {
	const values = preferencesSchema.parse(input);
	await writePreferences(values, dependencies, "Settings could not be saved.");
	return { status: "saved", values, message: "Settings saved." };
}

export async function resetPreferences(
	dependencies: SettingsServerDependencies = {},
): Promise<SettingsSaveResult<PreferenceSettings>> {
	await writePreferences(
		PREFERENCE_DEFAULTS,
		dependencies,
		"Settings could not be reset.",
	);
	return {
		status: "saved",
		values: PREFERENCE_DEFAULTS,
		message: "Settings are back to their defaults.",
	};
}

async function writePreferences(
	values: PreferenceSettings,
	dependencies: SettingsServerDependencies,
	failure: string,
) {
	const settingsPath = dependencies.settingsPath ?? resolveSettingsPath();
	try {
		for (const kind of PREFERENCE_CARDS)
			await writeSettingsCard(kind, values[kind], settingsPath);
	} catch (error) {
		console.error("[settings] writing preferences failed:", error);
		throw new Error(failure);
	}
}

export type RestartResult = {
	status: "restarted" | "nothing-to-restart" | "restart-skipped";
	message: string;
};

export async function restartStation(
	card?: SettingsCardKind,
	dependencies: SettingsServerDependencies = {},
): Promise<RestartResult> {
	try {
		const action = await restartServices(
			card ? [card] : undefined,
			{ skipSystemActions: dependencies.skipSystemActions },
			dependencies.runner,
		);
		if (action.attempted)
			return {
				status: "restarted",
				message: "Restarted. Your settings are live.",
			};
		return action.skipped
			? {
					status: "restart-skipped",
					message:
						"Restarting is disabled in this environment. Your settings apply the next time BirdNET starts.",
				}
			: {
					status: "nothing-to-restart",
					message: "Nothing needed restarting — this setting was already live.",
				};
	} catch {
		throw new Error(
			"BirdNET could not be restarted. Your settings are saved and will apply the next time it starts.",
		);
	}
}

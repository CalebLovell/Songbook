import "@tanstack/react-start/server-only";

import { randomUUID } from "node:crypto";
import {
	chmod,
	readFile,
	realpath,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import type { z } from "zod";
import {
	HIGHLIGHT_THRESHOLDS,
	type HighlightThresholds,
	thresholdsFromSettings,
} from "./highlight-thresholds.ts";

import {
	artworkSettingsSchema,
	detectionSettingsSchema,
	highlightSettingsSchema,
	parseSettingsCard,
	SETTINGS_DEFAULTS,
	type SettingsByKind,
	type SettingsCardKind,
} from "./settings-data.ts";

export function resolveSettingsPath() {
	return process.env.BIRDNET_CONF ?? "/etc/birdnet/birdnet.conf";
}

function decodeShellValue(value: string) {
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		return value
			.slice(1, -1)
			.replace(/\\(["\\$`])/g, (_match, escaped: string) => escaped);
	}
	return value;
}

export function parseBirdnetConfig(text: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const line of text.split(/\r?\n/)) {
		const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
		if (match) values[match[1]] = decodeShellValue(match[2]);
	}
	return values;
}

function numberValue(
	values: Record<string, string>,
	key: string,
	fallback: number,
) {
	const parsed = Number(values[key]);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function integerValue(
	values: Record<string, string>,
	key: string,
	fallback: number,
) {
	const parsed = Number(values[key]);
	return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function validFieldsOr<T extends Record<string, unknown>>(
	shape: { [K in keyof T]: z.ZodType },
	saved: T,
	fallback: T,
): T {
	return Object.fromEntries(
		Object.entries(saved).map(([key, value]) => [
			key,
			shape[key as keyof T].safeParse(value).success
				? value
				: fallback[key as keyof T],
		]),
	) as T;
}

function artworkPreferenceFrom(values: Record<string, string>) {
	return (
		artworkSettingsSchema.safeParse({ preference: values.BIRD_ARTWORK }).data
			?.preference ?? SETTINGS_DEFAULTS.artwork.preference
	);
}

function boostQuietRecordingsFrom(values: Record<string, string>) {
	const saved = values.BOOST_QUIET_RECORDINGS?.trim();
	return saved === undefined || saved === ""
		? SETTINGS_DEFAULTS.playback.boostQuietRecordings
		: saved !== "0";
}

export async function readSettingsPageValues(
	settingsPath = resolveSettingsPath(),
	timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Promise<SettingsByKind> {
	const values = parseBirdnetConfig(await readFile(settingsPath, "utf8"));
	const defaults = SETTINGS_DEFAULTS;
	return {
		station: parseSettingsCard("station", {
			siteName: values.SITE_NAME ?? "",
			latitude: numberValue(values, "LATITUDE", 0),
			longitude: numberValue(values, "LONGITUDE", 0),
			timezone,
			locationConfirmed: values.LOCATION_SOURCE?.trim() !== "ip",
		}),
		detection: validFieldsOr(
			detectionSettingsSchema.shape,
			{
				confidence: numberValue(
					values,
					"CONFIDENCE",
					defaults.detection.confidence,
				),
				sensitivity: numberValue(
					values,
					"SENSITIVITY",
					defaults.detection.sensitivity,
				),
				overlap: numberValue(values, "OVERLAP", defaults.detection.overlap),
				privacyThreshold: numberValue(
					values,
					"PRIVACY_THRESHOLD",
					defaults.detection.privacyThreshold,
				),
			},
			defaults.detection,
		),
		highlights: validFieldsOr(
			highlightSettingsSchema.shape,
			{
				rareMax: integerValue(
					values,
					"HIGHLIGHT_RARE_MAX",
					defaults.highlights.rareMax,
				),
				returnedDays: integerValue(
					values,
					"HIGHLIGHT_RETURNED_DAYS",
					defaults.highlights.returnedDays,
				),
				goneQuietDays: integerValue(
					values,
					"HIGHLIGHT_GONE_QUIET_DAYS",
					defaults.highlights.goneQuietDays,
				),
				regularDays: integerValue(
					values,
					"HIGHLIGHT_REGULAR_DAYS",
					defaults.highlights.regularDays,
				),
				vocalRatio: numberValue(
					values,
					"HIGHLIGHT_VOCAL_RATIO",
					defaults.highlights.vocalRatio,
				),
			},
			defaults.highlights,
		),
		artwork: { preference: artworkPreferenceFrom(values) },
		playback: { boostQuietRecordings: boostQuietRecordingsFrom(values) },
		updates: parseSettingsCard("updates", {
			automatic: values.AUTOMATIC_UPDATE?.trim() === "1",
		}),
	};
}

function quoteShellValue(value: string) {
	return `"${value.replace(/[\\"$`]/g, (character) => `\\${character}`)}"`;
}

function assignmentsFor<K extends SettingsCardKind>(
	kind: K,
	input: SettingsByKind[K],
): Record<string, string> {
	const value = parseSettingsCard(kind, input);
	switch (kind) {
		case "station": {
			const station = value as SettingsByKind["station"];
			return {
				SITE_NAME: quoteShellValue(station.siteName),
				LATITUDE: String(station.latitude),
				LONGITUDE: String(station.longitude),
				...(station.locationConfirmed === false
					? { LOCATION_SOURCE: "ip" }
					: { LOCATION_SOURCE: "user", LOCATION_PLACE: '""' }),
			};
		}
		case "detection": {
			const detection = value as SettingsByKind["detection"];
			return {
				CONFIDENCE: String(detection.confidence),
				SENSITIVITY: String(detection.sensitivity),
				OVERLAP: String(detection.overlap),
				PRIVACY_THRESHOLD: String(detection.privacyThreshold),
			};
		}
		case "artwork": {
			const artwork = value as SettingsByKind["artwork"];
			return { BIRD_ARTWORK: artwork.preference };
		}
		case "playback": {
			const playback = value as SettingsByKind["playback"];
			return {
				BOOST_QUIET_RECORDINGS: playback.boostQuietRecordings ? "1" : "0",
			};
		}
		case "updates": {
			const updates = value as SettingsByKind["updates"];
			return { AUTOMATIC_UPDATE: updates.automatic ? "1" : "0" };
		}
		case "highlights": {
			const highlights = value as SettingsByKind["highlights"];
			return {
				HIGHLIGHT_RARE_MAX: String(highlights.rareMax),
				HIGHLIGHT_RETURNED_DAYS: String(highlights.returnedDays),
				HIGHLIGHT_GONE_QUIET_DAYS: String(highlights.goneQuietDays),
				HIGHLIGHT_REGULAR_DAYS: String(highlights.regularDays),
				HIGHLIGHT_VOCAL_RATIO: String(highlights.vocalRatio),
			};
		}
	}
}

function replaceAssignments(text: string, assignments: Record<string, string>) {
	let updated = text;
	for (const [key, value] of Object.entries(assignments)) {
		const expression = new RegExp(`^${key}=.*$`, "m");
		if (expression.test(updated))
			updated = updated.replace(expression, () => `${key}=${value}`);
		else {
			if (updated.length > 0 && !updated.endsWith("\n")) updated += "\n";
			updated += `${key}=${value}\n`;
		}
	}
	return updated;
}

function isPermissionError(error: unknown) {
	const code = (error as NodeJS.ErrnoException).code;
	return code === "EACCES" || code === "EPERM";
}

export async function writeSettingsCard<K extends SettingsCardKind>(
	kind: K,
	values: SettingsByKind[K],
	settingsPath = resolveSettingsPath(),
) {
	const assignments = assignmentsFor(kind, values);
	settingsPath = await realpath(settingsPath);
	const source = await readFile(settingsPath, "utf8");
	const sourceStat = await stat(settingsPath);
	const updated = replaceAssignments(source, assignments);
	const temporaryPath = `${settingsPath}.tmp-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporaryPath, updated, {
			encoding: "utf8",
			mode: sourceStat.mode,
		});
		await chmod(temporaryPath, sourceStat.mode);
		await rename(temporaryPath, settingsPath);
	} catch (error) {
		// Editing /etc/birdnet/birdnet.conf with sed -i swaps the link to it for a
		// file in a folder only root can add to; the file itself stays writable.
		if (!isPermissionError(error)) throw error;
		await writeFile(settingsPath, updated, "utf8");
	} finally {
		await rm(temporaryPath, { force: true });
	}
	return parseSettingsCard(kind, values);
}

export async function readHighlightThresholds(
	settingsPath = resolveSettingsPath(),
): Promise<HighlightThresholds> {
	try {
		const values = parseBirdnetConfig(await readFile(settingsPath, "utf8"));
		const defaults = SETTINGS_DEFAULTS.highlights;
		const parsed = highlightSettingsSchema.safeParse({
			rareMax: integerValue(values, "HIGHLIGHT_RARE_MAX", defaults.rareMax),
			returnedDays: integerValue(
				values,
				"HIGHLIGHT_RETURNED_DAYS",
				defaults.returnedDays,
			),
			goneQuietDays: integerValue(
				values,
				"HIGHLIGHT_GONE_QUIET_DAYS",
				defaults.goneQuietDays,
			),
			regularDays: integerValue(
				values,
				"HIGHLIGHT_REGULAR_DAYS",
				defaults.regularDays,
			),
			vocalRatio: numberValue(
				values,
				"HIGHLIGHT_VOCAL_RATIO",
				defaults.vocalRatio,
			),
		});
		return parsed.success
			? thresholdsFromSettings(parsed.data)
			: HIGHLIGHT_THRESHOLDS;
	} catch {
		return HIGHLIGHT_THRESHOLDS;
	}
}

export async function readArtworkPreference(
	settingsPath = resolveSettingsPath(),
) {
	try {
		return artworkPreferenceFrom(
			parseBirdnetConfig(await readFile(settingsPath, "utf8")),
		);
	} catch {
		return SETTINGS_DEFAULTS.artwork.preference;
	}
}

export async function readBoostQuietRecordings(
	settingsPath = resolveSettingsPath(),
) {
	try {
		return boostQuietRecordingsFrom(
			parseBirdnetConfig(await readFile(settingsPath, "utf8")),
		);
	} catch {
		return SETTINGS_DEFAULTS.playback.boostQuietRecordings;
	}
}

export async function readSiteName(settingsPath = resolveSettingsPath()) {
	try {
		const values = parseBirdnetConfig(await readFile(settingsPath, "utf8"));
		return (values.SITE_NAME ?? "").trim();
	} catch {
		return "";
	}
}

import { z } from "zod";

import {
	artworkSettingsSchema,
	detectionSettingsSchema,
	highlightSettingsSchema,
	recordingSettingsSchema,
	reviewSettingsSchema,
	stationSettingsSchema,
	storageSettingsSchema,
} from "./settings-data.ts";

export const BACKUP_FORMAT = "songbook-backup";
export const BACKUP_FORMAT_VERSION = 1;

export const MANIFEST_PATH = "manifest.json";
export const SETTINGS_PATH = "settings.json";
export const DATABASE_PATH = "data/birds.db";
export const CHECKSUMS_PATH = "checksums.json";
export const SPECIES_LISTS_DIR = "species-lists";
export const CLIPS_DIR = "clips/By_Date";

export const SPECIES_LIST_FILES = [
	"include_species_list.txt",
	"exclude_species_list.txt",
	"whitelist_species_list.txt",
	"confirmed_species_list.txt",
] as const;

export const backupManifestSchema = z.object({
	format: z.literal(BACKUP_FORMAT),
	formatVersion: z.number().int().min(1),
	createdAt: z.iso.datetime(),
	stationName: z.string(),
	includesClips: z.boolean(),
});
export type BackupManifest = z.infer<typeof backupManifestSchema>;

export const backupChecksumsSchema = z.record(
	z.string(),
	z.object({
		size: z.number().int().min(0),
		sha256: z.string().regex(/^[0-9a-f]{64}$/),
	}),
);
export type BackupChecksums = z.infer<typeof backupChecksumsSchema>;

export const backupSettingsSchema = z.object({
	station: stationSettingsSchema,
	detection: detectionSettingsSchema,
	recording: recordingSettingsSchema,
	storage: storageSettingsSchema,
	review: reviewSettingsSchema,
	highlights: highlightSettingsSchema,
	artwork: artworkSettingsSchema,
});
export type BackupSettings = z.infer<typeof backupSettingsSchema>;

const CLIP_PATH =
	/^clips\/By_Date\/\d{4}-\d{2}-\d{2}\/(?<species>[^/\\]+)\/(?<file>[^/\\]+)$/;

export function isClipPath(entryPath: string): boolean {
	const match = CLIP_PATH.exec(entryPath);
	if (!match?.groups) return false;
	const { species, file } = match.groups;
	return ![species, file].some(
		(segment) => segment === "." || segment === ".." || segment.includes("\0"),
	);
}

export function isBackupPath(entryPath: string): boolean {
	if (
		entryPath === MANIFEST_PATH ||
		entryPath === SETTINGS_PATH ||
		entryPath === DATABASE_PATH ||
		entryPath === CHECKSUMS_PATH
	)
		return true;
	if (
		SPECIES_LIST_FILES.some(
			(file) => entryPath === `${SPECIES_LISTS_DIR}/${file}`,
		)
	)
		return true;
	return isClipPath(entryPath);
}

const dateRangeSchema = z.object({
	firstDate: z.string().nullable(),
	lastDate: z.string().nullable(),
});

export const restorePreviewSchema = dateRangeSchema.extend({
	id: z.uuid(),
	createdAt: z.iso.datetime(),
	stationName: z.string(),
	includesClips: z.boolean(),
	detections: z.number().int().min(0),
	species: z.number().int().min(0),
	clipFiles: z.number().int().min(0),
	clipBytes: z.number().int().min(0),
});
export type RestorePreview = z.infer<typeof restorePreviewSchema>;

export const safetyCopySchema = z.object({
	createdAt: z.iso.datetime(),
	includesClips: z.boolean(),
});
export type SafetyCopy = z.infer<typeof safetyCopySchema>;

export const dataSummarySchema = dateRangeSchema.extend({
	detections: z.number().int().min(0),
	databaseBytes: z.number().int().min(0),
	clipFiles: z.number().int().min(0),
	clipBytes: z.number().int().min(0),
	species: z.array(z.object({ sciName: z.string(), comName: z.string() })),
	safetyCopy: safetyCopySchema.nullable(),
	staged: restorePreviewSchema.nullable(),
});
export type DataSummary = z.infer<typeof dataSummarySchema>;

export const restoreOutcomeSchema = z.object({
	message: z.string(),
	warning: z.string().nullable(),
});
export type RestoreOutcome = z.infer<typeof restoreOutcomeSchema>;

const dayParam = z.iso.date().optional().catch(undefined);

export const detectionExportQuerySchema = z.object({
	from: dayParam,
	to: dayParam,
	species: z.string().min(1).max(200).optional().catch(undefined),
});
export type DetectionExportQuery = z.infer<typeof detectionExportQuerySchema>;

export function detectionExportUrl(query: DetectionExportQuery): string {
	const params = new URLSearchParams();
	if (query.from) params.set("from", query.from);
	if (query.to) params.set("to", query.to);
	if (query.species) params.set("species", query.species);
	const search = params.toString();
	return `/api/data/export${search ? `?${search}` : ""}`;
}

export function backupUrl(includeClips: boolean): string {
	return `/api/data/backup?clips=${includeClips ? "1" : "0"}`;
}

export const RESTORE_UPLOAD_URL = "/api/data/restore";

const BYTE_UNITS = ["KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	let value = bytes;
	let unit = -1;
	while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
		value /= 1024;
		unit += 1;
	}
	return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

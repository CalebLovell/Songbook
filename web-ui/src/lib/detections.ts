import { rm } from "node:fs/promises";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, count, desc, gte, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, openWritableDetectionsDb } from "~/db/index.ts";
import { type Detection, detections } from "~/db/schema.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import { audioUrlFor } from "~/lib/audio.ts";
import { requireUnlocked } from "~/lib/auth.ts";
import { hearableRecordings } from "~/lib/clip-access.server.ts";
import {
	type DetectionClipIdentity,
	resolveDetectionClipPath,
} from "~/lib/detection-file-path.server.ts";
import {
	type DetectionWorkspaceSearch,
	normalizeDetectionWorkspaceSearch,
} from "~/lib/detection-workspace.ts";
import { illustrationUrlFor } from "~/lib/illustrations.ts";
import { speciesFuse } from "~/lib/species-fuse.ts";
import { type SpeciesLink, speciesLinkFor } from "~/lib/species-link.ts";

export type DetectionTableRow = Omit<Detection, "Lat" | "Lon"> & {
	rowId: number;
};

export type DetectionPage = {
	rows: DetectionTableRow[];
	total: number;
};

async function fuzzySpeciesNames(query: string): Promise<string[]> {
	const names = await db
		.selectDistinct({
			comName: detections.Com_Name,
			sciName: detections.Sci_Name,
		})
		.from(detections);
	return speciesFuse(names)
		.search(query)
		.map((result) => result.item.comName);
}

function confidencePercent(query: string): number | null {
	const match = /^(\d{1,3})\s*%?$/.exec(query.trim());
	if (!match) return null;
	const percent = Number(match[1]);
	return percent >= 0 && percent <= 100 ? percent : null;
}

async function detectionFilters(search: DetectionWorkspaceSearch) {
	const filters = [];
	if (search.species) {
		const matches = await fuzzySpeciesNames(search.species);
		const percent = confidencePercent(search.species);
		const clauses = [];
		if (matches.length > 0) clauses.push(inArray(detections.Com_Name, matches));
		if (percent !== null) {
			clauses.push(
				sql`CAST(ROUND(${detections.Confidence} * 100) AS INTEGER) = ${percent}`,
			);
		}
		filters.push(clauses.length > 0 ? or(...clauses) : sql`1 = 0`);
	}
	if (search.minConfidence !== undefined) {
		filters.push(gte(detections.Confidence, search.minConfidence));
	}
	if (search.from) filters.push(gte(detections.Date, search.from));
	if (search.to) filters.push(lte(detections.Date, search.to));
	return filters.length > 0 ? and(...filters) : undefined;
}

function detectionOrder(
	search: DetectionWorkspaceSearch,
): ReturnType<typeof asc>[] {
	const order = search.direction === "asc" ? asc : desc;
	switch (search.sort) {
		case "species":
			return [
				order(detections.Com_Name),
				order(detections.Date),
				order(detections.Time),
			];
		case "scientific":
			return [
				order(detections.Sci_Name),
				order(detections.Date),
				order(detections.Time),
			];
		case "confidence":
			return [
				order(detections.Confidence),
				order(detections.Date),
				order(detections.Time),
			];
		default:
			return [order(detections.Date), order(detections.Time)];
	}
}

export const getDetectionsPage = createServerFn({ method: "GET" })
	.validator((input: Record<string, unknown>) =>
		normalizeDetectionWorkspaceSearch(input),
	)
	.handler(async ({ data }): Promise<DetectionPage> => {
		const filters = await detectionFilters(data);
		const [{ total }] = await db
			.select({ total: count() })
			.from(detections)
			.where(filters);
		const rows = await db
			.select({
				rowId: sql<number>`rowid`,
				Date: detections.Date,
				Time: detections.Time,
				Sci_Name: detections.Sci_Name,
				Com_Name: detections.Com_Name,
				Confidence: detections.Confidence,
				Cutoff: detections.Cutoff,
				Week: detections.Week,
				Sens: detections.Sens,
				Overlap: detections.Overlap,
				File_Name: detections.File_Name,
			})
			.from(detections)
			.where(filters)
			.orderBy(...detectionOrder(data))
			.limit(data.pageSize)
			.offset((data.page - 1) * data.pageSize);

		return { rows, total };
	});

type DeletionRequest = {
	rowIds: number[];
};

export type DeleteDetectionsResult = {
	deletedRecords: number;
	deletedFiles: number;
	missingFiles: number;
	failedFiles: number;
};

type SelectedDetection = DetectionClipIdentity & {
	rowId: number;
};

function validRowIds(rowIds: number[]): number[] {
	return [
		...new Set(
			rowIds.filter((rowId) => Number.isSafeInteger(rowId) && rowId > 0),
		),
	];
}

function readSelectedDetections(rowIds: number[]): SelectedDetection[] {
	const writable = openWritableDetectionsDb();
	const placeholders = rowIds.map(() => "?").join(", ");
	try {
		writable.exec("BEGIN IMMEDIATE");
		const selected = writable
			.prepare(
				`SELECT rowid AS rowId, Date AS date, Com_Name AS commonName, File_Name AS fileName FROM detections WHERE rowid IN (${placeholders})`,
			)
			.all(...rowIds) as SelectedDetection[];
		writable
			.prepare(`DELETE FROM detections WHERE rowid IN (${placeholders})`)
			.run(...rowIds);
		writable.exec("COMMIT");
		return selected;
	} catch (error) {
		try {
			writable.exec("ROLLBACK");
		} catch {}
		throw error;
	} finally {
		writable.close();
	}
}

async function deleteUnreferencedClips(
	selected: SelectedDetection[],
): Promise<Omit<DeleteDetectionsResult, "deletedRecords">> {
	const uniqueClips = new Map<string, DetectionClipIdentity>();
	for (const clip of selected) {
		uniqueClips.set(
			`${clip.date}\u0000${clip.commonName}\u0000${clip.fileName}`,
			clip,
		);
	}

	let deletedFiles = 0;
	let missingFiles = 0;
	let failedFiles = 0;
	for (const clip of uniqueClips.values()) {
		const [{ references }] = await db
			.select({ references: count() })
			.from(detections)
			.where(
				and(
					sql`${detections.Date} = ${clip.date}`,
					sql`${detections.Com_Name} = ${clip.commonName}`,
					sql`${detections.File_Name} = ${clip.fileName}`,
				),
			);
		if (references > 0) continue;

		const filePath = resolveDetectionClipPath(extractedDir(), clip);
		if (!filePath) {
			failedFiles += 1;
			continue;
		}

		try {
			await rm(filePath);
			deletedFiles += 1;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				missingFiles += 1;
			} else {
				failedFiles += 1;
			}
		}
	}

	return { deletedFiles, missingFiles, failedFiles };
}

export const deleteDetections = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(
		z
			.object({ rowIds: z.array(z.number()).max(10_000) })
			.transform((input: DeletionRequest) => ({
				rowIds: validRowIds(input.rowIds),
			})),
	)
	.handler(async ({ data }): Promise<DeleteDetectionsResult> => {
		if (data.rowIds.length === 0) {
			return {
				deletedRecords: 0,
				deletedFiles: 0,
				missingFiles: 0,
				failedFiles: 0,
			};
		}

		const selected = readSelectedDetections(data.rowIds);
		const fileResults = await deleteUnreferencedClips(selected);
		return { deletedRecords: selected.length, ...fileResults };
	});

export type LifeListCard = {
	comName: string;
	sciName: string;
	allTimeCount: number;
	hourCounts: number[];
	lastDetected: string;
	audioUrl: string | null;
	imageUrl: string | null;
	speciesLink: SpeciesLink | null;
};

export const getLifeListCards = createServerFn({ method: "GET" }).handler(
	async (): Promise<LifeListCard[]> => {
		const groups = await db
			.select({
				comName: detections.Com_Name,
				sciName: detections.Sci_Name,
				hour: sql<string>`substr(${detections.Time}, 1, 2)`,
				count: count(),
				latestAt: sql<string>`max(${detections.Date} || ' ' || ${detections.Time})`,
			})
			.from(detections)
			.groupBy(
				detections.Com_Name,
				detections.Sci_Name,
				sql`substr(${detections.Time}, 1, 2)`,
			);

		const best = await hearableRecordings();

		const cards = new Map<string, LifeListCard>();
		for (const group of groups) {
			let card = cards.get(group.comName);
			if (!card) {
				card = {
					comName: group.comName,
					sciName: group.sciName,
					allTimeCount: 0,
					hourCounts: new Array(24).fill(0),
					lastDetected: "",
					audioUrl: null,
					imageUrl: illustrationUrlFor(group.sciName),
					speciesLink: speciesLinkFor(group.sciName),
				};
				cards.set(group.comName, card);
			}
			card.allTimeCount += group.count;
			const hour = Number.parseInt(group.hour, 10);
			if (hour >= 0 && hour <= 23) card.hourCounts[hour] += group.count;
			if (group.latestAt > card.lastDetected) {
				card.lastDetected = group.latestAt;
			}
		}

		return [...cards.values()].map((card) => {
			const clip = best.get(card.comName);
			return {
				...card,
				audioUrl: clip
					? audioUrlFor(clip.date, card.comName, clip.fileName)
					: null,
			};
		});
	},
);

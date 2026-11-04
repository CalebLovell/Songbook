import { existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

import { commonNameSafe } from "~/lib/audio.ts";
import { resolveDetectionClipPath } from "~/lib/detection-file-path.server.ts";

const CANDIDATE_CLIPS_PER_SPECIES = 10;

export type BestRecording = {
	comName: string;
	sciName: string;
	date: string;
	time: string;
	confidence: number | null;
	fileName: string;
};

function candidateClips(
	database: DatabaseSync,
	comName?: string,
): BestRecording[] {
	const statement = database.prepare(`
		SELECT comName, sciName, date, time, confidence, fileName
		FROM (
			SELECT
				Com_Name AS comName,
				Sci_Name AS sciName,
				Date AS date,
				Time AS time,
				Confidence AS confidence,
				File_Name AS fileName,
				ROW_NUMBER() OVER (PARTITION BY Com_Name ORDER BY Confidence DESC, Date DESC, Time DESC) AS rn
			FROM detections
			${comName === undefined ? "" : "WHERE Com_Name = ?"}
		)
		WHERE rn <= ?
		ORDER BY comName, rn
	`);
	const rows =
		comName === undefined
			? statement.all(CANDIDATE_CLIPS_PER_SPECIES)
			: statement.all(comName, CANDIDATE_CLIPS_PER_SPECIES);
	return rows as BestRecording[];
}

export function bestRecordings(
	database: DatabaseSync,
	extractedRoot: string,
	comName?: string,
): Map<string, BestRecording> {
	const best = new Map<string, BestRecording>();
	for (const clip of candidateClips(database, comName)) {
		if (best.has(clip.comName)) continue;
		const filePath = resolveDetectionClipPath(extractedRoot, {
			date: clip.date,
			commonName: clip.comName,
			fileName: clip.fileName,
		});
		if (filePath !== null && existsSync(filePath)) best.set(clip.comName, clip);
	}
	return best;
}

export function isBestRecording(
	database: DatabaseSync,
	extractedRoot: string,
	clip: { date: string; speciesDir: string; fileName: string },
): boolean {
	const rows = database
		.prepare(
			"SELECT DISTINCT Com_Name AS comName FROM detections WHERE Date = ? AND File_Name = ?",
		)
		.all(clip.date, clip.fileName) as { comName: string }[];
	return rows.some(({ comName }) => {
		if (commonNameSafe(comName) !== clip.speciesDir) return false;
		const best = bestRecordings(database, extractedRoot, comName).get(comName);
		return best?.date === clip.date && best.fileName === clip.fileName;
	});
}

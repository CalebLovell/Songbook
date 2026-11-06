import { existsSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";

import { commonNameSafe } from "~/lib/audio.ts";
import { resolveDetectionClipPath } from "~/lib/detection-file-path.server.ts";

const CANDIDATE_CLIPS_PER_SPECIES = 10;

export const VOICE_SCORE_LIMIT = 0.1;

export type BestRecording = {
	comName: string;
	sciName: string;
	date: string;
	time: string;
	confidence: number | null;
	fileName: string;
};

type PublicCandidate = BestRecording & { voiceScore: number | null };

export type PublicRecordings = {
	recordings: Map<string, BestRecording>;
	unchecked: BestRecording[];
};

const CREATE_VOICE_CHECKS_TABLE = `CREATE TABLE IF NOT EXISTS voice_checks (
  Date TEXT NOT NULL,
  File_Name TEXT NOT NULL,
  voice_score REAL NOT NULL,
  checked_at TEXT NOT NULL,
  PRIMARY KEY (Date, File_Name)
)`;

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

function isOnDisk(extractedRoot: string, clip: BestRecording): boolean {
	const filePath = resolveDetectionClipPath(extractedRoot, {
		date: clip.date,
		commonName: clip.comName,
		fileName: clip.fileName,
	});
	return filePath !== null && existsSync(filePath);
}

export function bestRecordings(
	database: DatabaseSync,
	extractedRoot: string,
	comName?: string,
): Map<string, BestRecording> {
	const best = new Map<string, BestRecording>();
	for (const clip of candidateClips(database, comName)) {
		if (best.has(clip.comName)) continue;
		if (isOnDisk(extractedRoot, clip)) best.set(clip.comName, clip);
	}
	return best;
}

function voiceChecksTableExists(database: DatabaseSync): boolean {
	return (
		database
			.prepare(
				"SELECT 1 AS present FROM sqlite_master WHERE type='table' AND name='voice_checks'",
			)
			.get() !== undefined
	);
}

function publicCandidates(
	database: DatabaseSync,
	comName?: string,
): PublicCandidate[] {
	if (!voiceChecksTableExists(database)) {
		return candidateClips(database, comName).map((clip) => ({
			...clip,
			voiceScore: null,
		}));
	}
	const statement = database.prepare(`
		SELECT comName, sciName, date, time, confidence, fileName, voiceScore
		FROM (
			SELECT
				d.Com_Name AS comName,
				d.Sci_Name AS sciName,
				d.Date AS date,
				d.Time AS time,
				d.Confidence AS confidence,
				d.File_Name AS fileName,
				v.voice_score AS voiceScore,
				ROW_NUMBER() OVER (PARTITION BY d.Com_Name ORDER BY d.Confidence DESC, d.Date DESC, d.Time DESC) AS rn
			FROM detections d
			LEFT JOIN voice_checks v ON v.Date = d.Date AND v.File_Name = d.File_Name
			WHERE (v.voice_score IS NULL OR v.voice_score <= ?)
			${comName === undefined ? "" : "AND d.Com_Name = ?"}
		)
		WHERE rn <= ?
		ORDER BY comName, rn
	`);
	const rows =
		comName === undefined
			? statement.all(VOICE_SCORE_LIMIT, CANDIDATE_CLIPS_PER_SPECIES)
			: statement.all(VOICE_SCORE_LIMIT, comName, CANDIDATE_CLIPS_PER_SPECIES);
	return rows as PublicCandidate[];
}

export function publicRecordings(
	database: DatabaseSync,
	extractedRoot: string,
	comName?: string,
): PublicRecordings {
	const recordings = new Map<string, BestRecording>();
	const nextToCheck = new Map<string, BestRecording>();
	for (const { voiceScore, ...clip } of publicCandidates(database, comName)) {
		if (recordings.has(clip.comName)) continue;
		if (!isOnDisk(extractedRoot, clip)) continue;
		if (voiceScore !== null) {
			recordings.set(clip.comName, clip);
		} else if (!nextToCheck.has(clip.comName)) {
			nextToCheck.set(clip.comName, clip);
		}
	}
	return { recordings, unchecked: [...nextToCheck.values()] };
}

export function isPublicRecording(
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
		const { recordings } = publicRecordings(database, extractedRoot, comName);
		const recording = recordings.get(comName);
		return (
			recording?.date === clip.date && recording.fileName === clip.fileName
		);
	});
}

export function saveVoiceCheck(
	database: DatabaseSync,
	clip: Pick<BestRecording, "date" | "fileName">,
	voiceScore: number,
	checkedAt: string,
): void {
	database.exec(CREATE_VOICE_CHECKS_TABLE);
	database
		.prepare(
			"INSERT OR REPLACE INTO voice_checks (Date, File_Name, voice_score, checked_at) VALUES (?, ?, ?, ?)",
		)
		.run(clip.date, clip.fileName, voiceScore, checkedAt);
}

export async function checkUncheckedRecordings(
	database: DatabaseSync,
	extractedRoot: string,
	scoreClip: (clip: BestRecording) => Promise<number>,
	now: () => Date = () => new Date(),
): Promise<void> {
	for (;;) {
		const { unchecked } = publicRecordings(database, extractedRoot);
		if (unchecked.length === 0) return;
		for (const clip of unchecked) {
			const voiceScore = await scoreClip(clip);
			saveVoiceCheck(database, clip, voiceScore, now().toISOString());
		}
	}
}

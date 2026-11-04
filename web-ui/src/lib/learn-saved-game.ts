import type { LearnPool } from "~/lib/learn-pools.ts";
import type { LearnRound, QuestionResult } from "~/lib/learn-round.ts";

export type GameProgress = {
	index: number;
	wrongGuesses: string[];
	isSolved: boolean;
	results: QuestionResult[];
	isFinished: boolean;
};

export const FRESH_PROGRESS: GameProgress = {
	index: 0,
	wrongGuesses: [],
	isSolved: false,
	results: [],
	isFinished: false,
};

export type SavedGame = { round: LearnRound; progress: GameProgress };

const KEY_PREFIX = "learn-game:v1:";

function isSavedGame(value: unknown): value is SavedGame {
	if (typeof value !== "object" || value === null) return false;
	const { round, progress } = value as Partial<SavedGame>;
	return (
		typeof round?.id === "string" &&
		Array.isArray(round.questions) &&
		round.questions.length > 0 &&
		typeof progress?.index === "number" &&
		progress.index >= 0 &&
		progress.index < round.questions.length &&
		Array.isArray(progress.wrongGuesses) &&
		Array.isArray(progress.results) &&
		typeof progress.isSolved === "boolean" &&
		typeof progress.isFinished === "boolean"
	);
}

export function loadSavedGame(pool: LearnPool): SavedGame | null {
	try {
		const raw = sessionStorage.getItem(KEY_PREFIX + pool);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		return isSavedGame(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function loadResumableGame(
	pool: LearnPool,
	dealt: LearnRound,
): SavedGame | null {
	if (dealt.questions.length > 0) return loadSavedGame(pool);
	try {
		sessionStorage.removeItem(KEY_PREFIX + pool);
	} catch {}
	return null;
}

export function saveGame(pool: LearnPool, game: SavedGame) {
	try {
		sessionStorage.setItem(KEY_PREFIX + pool, JSON.stringify(game));
	} catch {}
}

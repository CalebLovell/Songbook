import type { LearnPool } from "~/lib/learn-pools.ts";
import type { GameProgress } from "~/lib/learn-progress.ts";
import type { LearnRound } from "~/lib/learn-round.ts";

export type SavedGame = { round: LearnRound; progress: GameProgress };

const KEY_PREFIX = "learn-game:v2:";
const PHASES: readonly unknown[] = ["guessing", "solved", "finished"];

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
		PHASES.includes(progress.phase)
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

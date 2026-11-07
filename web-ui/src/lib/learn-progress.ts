import type { QuestionResult } from "~/lib/learn-round.ts";

export type GameProgress = {
	phase: "guessing" | "solved" | "finished";
	index: number;
	wrongGuesses: string[];
	results: QuestionResult[];
};

export const FRESH_PROGRESS: GameProgress = {
	phase: "guessing",
	index: 0,
	wrongGuesses: [],
	results: [],
};

export function progressAfterGuess(
	progress: GameProgress,
	guessed: string,
	answer: string,
): GameProgress {
	if (progress.phase !== "guessing") return progress;
	if (progress.wrongGuesses.includes(guessed)) return progress;
	if (guessed !== answer) {
		return {
			...progress,
			wrongGuesses: [...progress.wrongGuesses, guessed],
		};
	}
	return {
		...progress,
		phase: "solved",
		results: [
			...progress.results,
			{ attempts: progress.wrongGuesses.length + 1 },
		],
	};
}

export function progressAfterAdvance(
	progress: GameProgress,
	questionCount: number,
): GameProgress {
	if (progress.phase !== "solved") return progress;
	if (progress.index + 1 >= questionCount) {
		return { ...progress, phase: "finished" };
	}
	return {
		...progress,
		phase: "guessing",
		index: progress.index + 1,
		wrongGuesses: [],
	};
}

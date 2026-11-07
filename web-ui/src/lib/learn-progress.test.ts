import assert from "node:assert/strict";
import { test } from "node:test";

import {
	FRESH_PROGRESS,
	type GameProgress,
	progressAfterAdvance,
	progressAfterGuess,
} from "~/lib/learn-progress.ts";

const ANSWER = "Turdus migratorius";
const WRONG = "Cardinalis cardinalis";

test("a wrong guess is remembered and the question stays open", () => {
	const next = progressAfterGuess(FRESH_PROGRESS, WRONG, ANSWER);
	assert.equal(next.phase, "guessing");
	assert.deepEqual(next.wrongGuesses, [WRONG]);
	assert.deepEqual(next.results, []);
});

test("repeating a wrong guess changes nothing", () => {
	const once = progressAfterGuess(FRESH_PROGRESS, WRONG, ANSWER);
	assert.equal(progressAfterGuess(once, WRONG, ANSWER), once);
});

test("the right guess solves the question and counts every attempt", () => {
	const once = progressAfterGuess(FRESH_PROGRESS, WRONG, ANSWER);
	const solved = progressAfterGuess(once, ANSWER, ANSWER);
	assert.equal(solved.phase, "solved");
	assert.deepEqual(solved.results, [{ attempts: 2 }]);
});

test("guesses after solving are ignored", () => {
	const solved = progressAfterGuess(FRESH_PROGRESS, ANSWER, ANSWER);
	assert.equal(progressAfterGuess(solved, WRONG, ANSWER), solved);
});

test("advancing needs a solved question", () => {
	assert.equal(progressAfterAdvance(FRESH_PROGRESS, 5), FRESH_PROGRESS);
});

test("advancing moves to the next question with a clean slate", () => {
	const once = progressAfterGuess(FRESH_PROGRESS, WRONG, ANSWER);
	const solved = progressAfterGuess(once, ANSWER, ANSWER);
	assert.deepEqual(progressAfterAdvance(solved, 5), {
		phase: "guessing",
		index: 1,
		wrongGuesses: [],
		results: [{ attempts: 2 }],
	});
});

test("advancing past the last question finishes the round", () => {
	const last: GameProgress = { ...FRESH_PROGRESS, phase: "solved", index: 4 };
	const finished = progressAfterAdvance(last, 5);
	assert.equal(finished.phase, "finished");
	assert.equal(progressAfterAdvance(finished, 5), finished);
});

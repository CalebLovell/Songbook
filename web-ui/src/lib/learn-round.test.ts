import assert from "node:assert/strict";
import test from "node:test";

import {
	buildRound,
	CHOICES_PER_QUESTION,
	type PoolSpecies,
	scoreRound,
} from "./learn-round.ts";

function speciesNamed(name: string, clipCount = 3): PoolSpecies {
	return {
		comName: name,
		sciName: `Genus ${name}`,
		speciesSlug: name.toLowerCase(),
		imageUrl: null,
		clips: Array.from({ length: clipCount }, (_, index) => ({
			date: "2026-07-25",
			fileName: `${name}-${index}.mp3`,
			detectedAt: `2026-07-25 06:0${index}:00`,
			confidence: 0.9,
		})),
	};
}

function poolOf(count: number): PoolSpecies[] {
	return Array.from({ length: count }, (_, index) =>
		speciesNamed(`Bird${index}`),
	);
}

const alwaysZero = () => 0;

test("asks every bird in the pool once", () => {
	const round = buildRound(poolOf(23), alwaysZero);
	const answers = round.questions.map((question) => question.answerSciName);

	assert.equal(round.questions.length, 23);
	assert.equal(new Set(answers).size, 23);
	assert.equal(round.speciesInPool, 23);
});

test("a pool smaller than ten still makes a round of its own size", () => {
	const round = buildRound(poolOf(CHOICES_PER_QUESTION));

	assert.equal(round.questions.length, CHOICES_PER_QUESTION);
});

test("gives every question the right number of distinct choices", () => {
	for (const question of buildRound(poolOf(10)).questions) {
		assert.equal(question.choices.length, CHOICES_PER_QUESTION);
		const names = new Set(question.choices.map((choice) => choice.sciName));
		assert.equal(names.size, CHOICES_PER_QUESTION);
	}
});

test("always includes the answer among the choices", () => {
	for (const question of buildRound(poolOf(6)).questions) {
		assert.ok(
			question.choices.some(
				(choice) => choice.sciName === question.answerSciName,
			),
		);
	}
});

test("returns an empty round when the pool cannot fill the choices", () => {
	const round = buildRound(poolOf(CHOICES_PER_QUESTION - 1));

	assert.deepEqual(round.questions, []);
	assert.equal(round.speciesInPool, CHOICES_PER_QUESTION - 1);
});

test("ignores species that have no playable clips", () => {
	const pool = [...poolOf(4), speciesNamed("Silent", 0)];
	const round = buildRound(pool);

	assert.equal(round.speciesInPool, 4);
	for (const question of round.questions) {
		assert.ok(question.choices.every((choice) => choice.comName !== "Silent"));
	}
});

test("scores one point per bird named on the first try", () => {
	const score = scoreRound([
		{ attempts: 1 },
		{ attempts: 2 },
		{ attempts: 1 },
		{ attempts: 4 },
	]);

	assert.deepEqual(score, { firstTry: 2, answered: 4 });
});

test("scores an empty round at zero", () => {
	assert.deepEqual(scoreRound([]), { firstTry: 0, answered: 0 });
});

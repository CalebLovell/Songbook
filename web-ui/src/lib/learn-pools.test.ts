import assert from "node:assert/strict";
import test from "node:test";

import {
	COMMON_FLOOR,
	commonMinimum,
	familiarityPool,
	learnPoolMeanings,
} from "~/lib/learn-pools.ts";

test("rare is the app's rare cutoff, common starts at commonMin, uncommon between", () => {
	const thresholds = { rareMax: 5, commonMin: 40 };
	assert.equal(familiarityPool(1, thresholds), "rare");
	assert.equal(familiarityPool(5, thresholds), "rare");
	assert.equal(familiarityPool(6, thresholds), "uncommon");
	assert.equal(familiarityPool(39, thresholds), "uncommon");
	assert.equal(familiarityPool(40, thresholds), "common");
});

test("common is the most-heard third of the species past rare", () => {
	const counts = [3, 4, 900, 400, 120, 60, 30, 25, 22, 21, 8, 7];
	assert.equal(commonMinimum(counts, 5), 60);
});

test("species tied at the cutoff are all common", () => {
	assert.equal(commonMinimum([50, 50, 50, 10, 10, 10], 5), 50);
});

test("a young station's common pool needs at least the floor", () => {
	assert.equal(commonMinimum([12, 9, 7, 2, 1], 5), COMMON_FLOOR);
	assert.equal(commonMinimum([], 5), COMMON_FLOOR);
	assert.equal(commonMinimum([1, 2, 3], 5), COMMON_FLOOR);
});

test("a rare cutoff past the floor pushes common up rather than overlapping it", () => {
	assert.equal(commonMinimum([30, 28, 25], 150), 151);
});

test("the info tip states the same cutoffs", () => {
	const meanings = learnPoolMeanings({ rareMax: 5, commonMin: 60 });
	assert.equal(
		meanings.common,
		"the most-heard third of species at this station, now those heard 60 or more times.",
	);
	assert.equal(meanings.uncommon, "species heard 6 to 59 times.");
	assert.equal(meanings.rare, "species heard 5 or fewer times.");
});

test("the info tip owns up to an empty uncommon range", () => {
	const meanings = learnPoolMeanings({ rareMax: 150, commonMin: 151 });
	assert.equal(
		meanings.uncommon,
		"none yet: every species past rare is common.",
	);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { fitSize, truncate, wrapLines } from "~/lib/share-image-text.ts";

const measure = (text: string, size: number) => text.length * size;

test("fitSize picks the largest size every text fits at", () => {
	assert.equal(fitSize(measure, ["abcd", "ab"], 200, 80, 20), 50);
});

test("fitSize stops at the smallest size when nothing fits", () => {
	assert.equal(fitSize(measure, ["a very long name"], 10, 80, 20), 20);
});

test("truncate leaves text that fits alone", () => {
	assert.equal(truncate(measure, "Wren", 10, 40), "Wren");
});

test("truncate ends a long name with an ellipsis that fits", () => {
	const short = truncate(measure, "Ruby-crowned Kinglet", 10, 80);
	assert.equal(short, "Ruby-cr…");
	assert.ok(measure(short, 10) <= 80);
});

test("wrapLines breaks between words", () => {
	assert.deepEqual(wrapLines(measure, "Black-capped Chickadee", 10, 130, 2), [
		"Black-capped",
		"Chickadee",
	]);
});

test("wrapLines folds the overflow into the last line and truncates it", () => {
	assert.deepEqual(wrapLines(measure, "aa bb cc dd", 10, 50, 2), [
		"aa bb",
		"cc dd",
	]);
	assert.deepEqual(wrapLines(measure, "aa bb cc dd ee", 10, 50, 2), [
		"aa bb",
		"cc d…",
	]);
});

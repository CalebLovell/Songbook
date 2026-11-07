import assert from "node:assert/strict";
import test from "node:test";

import {
	type DetectionWorkspaceSearch,
	nextDetectionSort,
} from "./detection-workspace.ts";

const search: DetectionWorkspaceSearch = {
	page: 3,
	sort: "recorded",
	direction: "desc",
};

test("a new column starts in its natural order", () => {
	assert.equal(nextDetectionSort(search, "species").direction, "asc");
	assert.equal(nextDetectionSort(search, "scientific").direction, "asc");
	assert.equal(nextDetectionSort(search, "confidence").direction, "desc");
	assert.equal(
		nextDetectionSort(
			{ ...search, sort: "species", direction: "asc" },
			"recorded",
		).direction,
		"desc",
	);
});

test("the column already sorted by turns around", () => {
	assert.equal(nextDetectionSort(search, "recorded").direction, "asc");
	assert.equal(
		nextDetectionSort(
			{ ...search, sort: "species", direction: "asc" },
			"species",
		).direction,
		"desc",
	);
});

test("any sort change returns to the first page", () => {
	const next = nextDetectionSort(search, "species");
	assert.equal(next.page, 1);
	assert.equal(next.sort, "species");
});

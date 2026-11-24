import assert from "node:assert/strict";
import { test } from "node:test";

import { timelineTotals } from "~/lib/timeline-totals.ts";

test("totals add up every row and name the earliest busiest hour", () => {
	assert.deepEqual(
		timelineTotals([
			{ hourCounts: [0, 3, 1], totalDetections: 4 },
			{ hourCounts: [0, 0, 2], totalDetections: 2 },
		]),
		{ species: 2, detections: 6, peakHour: 1 },
	);
});

test("an empty window has no peak hour", () => {
	assert.deepEqual(timelineTotals([]), {
		species: 0,
		detections: 0,
		peakHour: null,
	});
});

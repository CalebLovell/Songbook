import assert from "node:assert/strict";
import test from "node:test";

import { deriveSpeciesTrends } from "./trend.ts";

const rows = [
	{ date: "2024-03-01", hour: "06", count: 2 },
	{ date: "2024-03-01", hour: "07", count: 3 },
	{ date: "2024-12-31", hour: "23", count: 1 },
	{ date: "2025-01-01", hour: "00", count: 4 },
	{ date: "2025-03-15", hour: "06", count: 5 },
];

test("years run newest first", () => {
	assert.deepEqual(
		deriveSpeciesTrends(rows, 2024).availableYears,
		[2025, 2024],
	);
});

test("months and hours add up across every year", () => {
	const { detectionTrend, hourActivity } = deriveSpeciesTrends(rows, 2024);
	assert.equal(detectionTrend.length, 12);
	assert.equal(detectionTrend[0].count, 4);
	assert.equal(detectionTrend[2].count, 10);
	assert.equal(detectionTrend[11].count, 1);
	assert.equal(hourActivity.length, 24);
	assert.equal(hourActivity[0].count, 4);
	assert.equal(hourActivity[6].count, 7);
	assert.equal(hourActivity[7].count, 3);
	assert.equal(hourActivity[23].count, 1);
});

test("a past year has one bar per calendar day and only that year's detections", () => {
	const { history } = deriveSpeciesTrends(rows, 2024);
	assert.equal(history.length, 366);
	assert.equal(history[0].bucket, "2024-01-01");
	assert.equal(history[365].bucket, "2024-12-31");
	assert.equal(history[365].count, 1);
	assert.equal(history.find((day) => day.bucket === "2024-03-01")?.count, 5);
	assert.equal(
		history.reduce((total, day) => total + day.count, 0),
		6,
	);
});

test("the current year is the rolling 365 days ending today", () => {
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, "0");
	const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	const { history } = deriveSpeciesTrends(
		[{ date: today, hour: "06", count: 9 }],
		now.getFullYear(),
	);
	assert.equal(history.length, 365);
	assert.deepEqual(
		{ bucket: history[364].bucket, count: history[364].count },
		{ bucket: today, count: 9 },
	);
});

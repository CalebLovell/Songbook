import assert from "node:assert/strict";
import test from "node:test";

import { formatClockRange, formatTimeAgo, hourLabel } from "./time-ago.ts";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

test("labels anything under a minute as just now", () => {
	assert.equal(formatTimeAgo(0), "just now");
	assert.equal(formatTimeAgo(9 * SECOND), "just now");
	assert.equal(formatTimeAgo(MINUTE - SECOND), "just now");
});

test("reads a clock running ahead of the viewer as just now", () => {
	assert.equal(formatTimeAgo(-30 * SECOND), "just now");
});

test("labels minutes, hours and days", () => {
	assert.equal(formatTimeAgo(2 * MINUTE), "2 minutes ago");
	assert.equal(formatTimeAgo(3 * HOUR), "3 hours ago");
	assert.equal(formatTimeAgo(2 * DAY), "2 days ago");
});

test("labels months and years for older visits", () => {
	assert.equal(formatTimeAgo(45 * DAY), "1 month ago");
	assert.equal(formatTimeAgo(3 * MONTH), "3 months ago");
	assert.equal(formatTimeAgo(YEAR), "1 year ago");
	assert.equal(formatTimeAgo(3 * YEAR), "3 years ago");
});

test("uses singular units for a count of one", () => {
	assert.equal(formatTimeAgo(MINUTE), "1 minute ago");
	assert.equal(formatTimeAgo(HOUR), "1 hour ago");
	assert.equal(formatTimeAgo(DAY), "1 day ago");
	assert.equal(formatTimeAgo(MONTH), "1 month ago");
	assert.equal(formatTimeAgo(YEAR), "1 year ago");
});

test("switches unit exactly at each boundary", () => {
	assert.equal(formatTimeAgo(HOUR - SECOND), "59 minutes ago");
	assert.equal(formatTimeAgo(DAY - SECOND), "23 hours ago");
	assert.equal(formatTimeAgo(MONTH - SECOND), "29 days ago");
	assert.equal(formatTimeAgo(YEAR - SECOND), "12 months ago");
});

test("labels hours in twelve-hour time", () => {
	assert.equal(hourLabel(0), "12 AM");
	assert.equal(hourLabel(6), "6 AM");
	assert.equal(hourLabel(12), "12 PM");
	assert.equal(hourLabel(18), "6 PM");
});

test("a visit inside one minute reads as a single clock time", () => {
	assert.equal(
		formatClockRange("2026-07-25 06:02:03", "2026-07-25 06:02:51"),
		"6:02 AM",
	);
});

test("a visit spanning minutes says its meridiem once", () => {
	assert.equal(
		formatClockRange("2026-07-25 06:02:03", "2026-07-25 06:24:10"),
		"6:02–6:24 AM",
	);
});

test("a visit across noon keeps both meridiems", () => {
	assert.equal(
		formatClockRange("2026-07-25 11:55:00", "2026-07-25 12:05:00"),
		"11:55 AM–12:05 PM",
	);
});

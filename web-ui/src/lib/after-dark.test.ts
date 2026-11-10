import assert from "node:assert/strict";
import test from "node:test";

import {
	afterDarkSightings,
	darkClockBounds,
	darkHours,
	nightOf,
} from "./after-dark.ts";

const cincinnati = {
	latitude: 39.3434,
	longitude: -84.4009,
	timezone: "America/New_York",
};

test("dark runs from nautical dusk to nautical dawn in station time", () => {
	const july = darkHours("2026-07-05", cincinnati);
	const november = darkHours("2026-11-10", cincinnati);
	assert.ok(july && november);
	assert.ok(july.dusk > 21 * 60 + 45 && july.dusk < 22 * 60 + 30);
	assert.ok(july.dawn > 5 * 60 && july.dawn < 5 * 60 + 30);
	assert.ok(november.dusk > 18 * 60 && november.dusk < 18 * 60 + 45);
});

test("a station with no location has no dark hours", () => {
	assert.equal(
		darkHours("2026-07-05", { ...cincinnati, latitude: 0, longitude: 0 }),
		null,
	);
});

test("a call before dawn belongs to the night before", () => {
	const hours = { dawn: 5 * 60, dusk: 22 * 60 };
	assert.equal(
		nightOf({ date: "2026-10-02", time: "23:10:00" }, hours),
		"2026-10-02",
	);
	assert.equal(
		nightOf({ date: "2026-10-03", time: "02:10:00" }, hours),
		"2026-10-02",
	);
	assert.equal(nightOf({ date: "2026-10-03", time: "12:00:00" }, hours), null);
});

test("sightings count nights, keep the latest call and the best score", () => {
	const sightings = afterDarkSightings(
		[
			{
				comName: "Swan",
				date: "2026-10-02",
				time: "23:10:00",
				confidence: 0.8,
			},
			{
				comName: "Swan",
				date: "2026-10-03",
				time: "02:14:00",
				confidence: 0.89,
			},
			{
				comName: "Swan",
				date: "2026-10-05",
				time: "01:00:00",
				confidence: 0.84,
			},
			{
				comName: "Robin",
				date: "2026-10-05",
				time: "12:00:00",
				confidence: 0.99,
			},
		],
		cincinnati,
	);
	assert.deepEqual(sightings.get("Swan"), {
		nights: 2,
		latest: "01:00",
		best: 0.89,
	});
	assert.equal(sightings.has("Robin"), false);
});

test("the clock bounds cover every night in the window", () => {
	const bounds = darkClockBounds(["2026-07-05", "2026-11-10"], cincinnati);
	assert.ok(bounds);
	assert.ok(bounds.before > "06:00" && bounds.before < "07:00");
	assert.ok(bounds.from > "18:00" && bounds.from < "19:00");
});

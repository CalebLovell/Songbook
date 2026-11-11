import assert from "node:assert/strict";
import test from "node:test";

import { formatShareCard } from "./share-card.ts";
import { formatTimelineShareCard } from "./timeline-share.ts";

test("day share card keeps one line per highlight and only the top bird", () => {
	const text = formatShareCard({
		date: "2026-11-10",
		window: "day",
		species: 24,
		detections: 1386,
		topSpecies: [
			{ comName: "Carolina Wren", count: 312 },
			{ comName: "Northern Cardinal", count: 204 },
		],
		busiestHour: { hour: 7, count: 200 },
		heading: ["Day", "Mon, Nov 10"],
		stationName: "Backyard",
		highlights: [
			{
				kind: "activity",
				direction: "up",
				percent: 18,
				baselineLabel: "yesterday",
				count: 1386,
				delta: 211,
			},
			{
				kind: "new",
				total: 1,
				birds: [{ comName: "Fox Sparrow", note: null }],
			},
			{
				kind: "consistent",
				total: 11,
				birds: [
					{ comName: "Carolina Wren", note: "24 days straight" },
					{ comName: "Blue Jay", note: "12 days straight" },
				],
			},
		],
	});

	assert.equal(
		text,
		[
			"📖  Songbook",
			"📍  Backyard",
			"📅  Day Summary · Mon, Nov 10",
			"",
			"🐦  24 species · 1,386 detections",
			"🌅  Peak hour · 7 AM",
			"📈  Up 18% from yesterday",
			"🥇  Carolina Wren · 312",
			"",
			"🐣  New · Fox Sparrow",
			"🏠  Regulars · Carolina Wren +10",
		].join("\n"),
	);
});

test("timeline share card without a date keeps the summary line alone", () => {
	const text = formatTimelineShareCard({
		period: "all",
		heading: ["All-time"],
		highlights: [],
		rows: [{ comName: "Blue Jay", hourCounts: [0, 1], totalDetections: 1 }],
	});

	assert.equal(
		text,
		[
			"📖  Songbook",
			"📅  All-time Summary",
			"",
			"🐦  1 species · 1 detection",
			"🌅  Peak hour · 1 AM",
			"🥇  Blue Jay · 1",
		].join("\n"),
	);
});

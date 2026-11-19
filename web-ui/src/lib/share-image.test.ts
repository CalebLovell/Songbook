import assert from "node:assert/strict";
import { test } from "node:test";

import type { Highlight } from "~/lib/highlights-data.ts";
import {
	formatHighlightLines,
	formatShareLine,
} from "~/lib/highlights-share.ts";
import { formatShareCard } from "~/lib/share-card.ts";
import { buildShareImage, type ShareImageInput } from "~/lib/share-image.ts";

const highlights: Highlight[] = [
	{
		kind: "new",
		total: 3,
		birds: [{ comName: "Cedar Waxwing", note: null }],
	},
	{
		kind: "activity",
		direction: "down",
		percent: 12,
		baselineLabel: "yesterday",
		count: 100,
		delta: -10,
	},
	{ kind: "busiest-hour", hour: 6 },
	{ kind: "rare", total: 1, birds: [{ comName: "Snowy Owl", note: null }] },
];

const input: ShareImageInput = {
	heading: ["Daily", "Nov 18"],
	stationName: "Back Yard",
	species: 7,
	detections: 1234,
	peakHour: 6,
	birds: [
		{ comName: "Blue Jay", sciName: "Cyanocitta cristata", count: 40 },
		{
			comName: "Northern Cardinal",
			sciName: "Cardinalis cardinalis",
			count: 900,
		},
		{
			comName: "Carolina Wren",
			sciName: "Thryothorus ludovicianus",
			count: 120,
		},
		{ comName: "Mourning Dove", sciName: "Zenaida macroura", count: 60 },
	],
	highlights,
};

test("the podium holds the three busiest birds in order", () => {
	const podium = buildShareImage(input)?.podium;
	assert.deepEqual(
		podium?.map((bird) => bird.comName),
		["Northern Cardinal", "Carolina Wren", "Mourning Dove"],
	);
	assert.equal(podium?.[0].countLabel, "900 detections");
});

test("a short day fills only the places it has", () => {
	const podium = buildShareImage({
		...input,
		birds: input.birds.slice(0, 1),
	})?.podium;
	assert.deepEqual(
		podium?.map((bird) => bird.comName),
		["Blue Jay"],
	);
});

test("a painted bird carries its painting and bounds", () => {
	const art = buildShareImage(input)?.podium[0].art;
	assert.equal(art?.kind, "painting");
	assert.match(art?.url ?? "", /^\/illustrations\/cardinalis-cardinalis\.webp/);
});

test("the title and date read like the text summary", () => {
	const model = buildShareImage(input);
	assert.equal(model?.title, "Daily Summary");
	assert.equal(model?.subtitle, "Nov 18");
	assert.equal(model?.fileName, "songbook-daily-nov-18.png");
	const all = buildShareImage({ ...input, heading: ["All Time"] });
	assert.equal(all?.title, "All Time Summary");
	assert.equal(all?.subtitle, null);
});

test("the stats read species, detections and the peak hour", () => {
	assert.deepEqual(buildShareImage(input)?.stats, [
		{ label: "Species", value: "7" },
		{ label: "Detections", value: "1,234" },
		{ label: "Peak hour", value: "6 AM" },
	]);
	assert.equal(buildShareImage({ ...input, peakHour: null })?.stats.length, 2);
});

test("the image's highlight lines are the text's, activity first", () => {
	const lines = buildShareImage(input)?.lines ?? [];
	assert.deepEqual(
		lines.map(({ label, bird }) => [label, bird]),
		[
			["Activity", null],
			["New", "Cedar Waxwing"],
			["Rare", "Snowy Owl"],
		],
	);
	const text = formatShareCard({
		date: "2026-11-18",
		species: 7,
		detections: 1234,
		topSpecies: [],
		busiestHour: null,
		highlights,
		heading: input.heading,
	});
	for (const line of lines) {
		assert.ok(text.includes(formatShareLine(line)), formatShareLine(line));
	}
	assert.deepEqual(
		lines.slice(1).map(formatShareLine),
		formatHighlightLines(highlights),
	);
});

test("there is no image when nothing was heard", () => {
	assert.equal(buildShareImage({ ...input, birds: [] }), null);
	assert.equal(buildShareImage({ ...input, detections: 0 }), null);
});

test("a blank station name is left off", () => {
	assert.equal(
		buildShareImage({ ...input, stationName: "  " })?.stationName,
		null,
	);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Highlight } from "~/lib/highlights-data.ts";
import { buildShareImages, type ShareImageInput } from "~/lib/share-image.ts";

const SEED = 7;

const named = (...names: string[]) =>
	names.map((comName) => ({ comName, note: null }));

const highlights: Highlight[] = [
	{
		kind: "activity",
		direction: "down",
		percent: 12,
		baselineLabel: "yesterday",
		count: 100,
		delta: -10,
	},
	{ kind: "busiest-hour", hour: 6 },
	{ kind: "new", total: 1, birds: named("House Finch") },
	{ kind: "consistent", total: 2, birds: named("Blue Jay", "Carolina Wren") },
	{ kind: "after-dark", total: 1, birds: named("Blue Jay") },
	{ kind: "routine", total: 1, birds: named("Hermit Thrush") },
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
		{ comName: "House Finch", sciName: "Haemorhous mexicanus", count: 30 },
		{ comName: "Downy Woodpecker", sciName: "Dryobates pubescens", count: 20 },
	],
	highlights,
	highlightSciNames: {
		"House Finch": "Haemorhous mexicanus",
		"Blue Jay": "Cyanocitta cristata",
		"Carolina Wren": "Thryothorus ludovicianus",
		"Hermit Thrush": "Catharus guttatus",
	},
};

const build = (changes: Partial<ShareImageInput> = {}) =>
	buildShareImages({ ...input, ...changes }, SEED);

test("the top birds image lists the five busiest birds in order", () => {
	assert.deepEqual(
		build()?.topBirds.rows.map(
			(row) => row.kind === "count" && [row.comName, row.count],
		),
		[
			["Northern Cardinal", "900"],
			["Carolina Wren", "120"],
			["Mourning Dove", "60"],
			["Blue Jay", "40"],
			["House Finch", "30"],
		],
	);
});

test("a short day fills only the places it has", () => {
	assert.deepEqual(
		build({ birds: input.birds.slice(0, 1) })?.topBirds.rows.map(
			(row) => row.comName,
		),
		["Blue Jay"],
	);
});

test("the highlights image has one bird per highlight, repeating none it can avoid", () => {
	assert.deepEqual(
		build()?.highlights?.rows.map(
			(row) => row.kind === "highlight" && [row.label, row.comName],
		),
		[
			["New", "House Finch"],
			["Regular", "Carolina Wren"],
			["After dark", "Blue Jay"],
			["Gone quiet", "Hermit Thrush"],
		],
	);
});

test("a bird that is the only choice for two highlights appears in both", () => {
	assert.deepEqual(
		build({
			highlights: [
				{ kind: "new", total: 1, birds: named("Blue Jay") },
				{ kind: "vocal", total: 1, birds: named("Blue Jay") },
			],
		})?.highlights?.rows.map((row) => row.comName),
		["Blue Jay", "Blue Jay"],
	);
});

test("a gone-quiet bird keeps its picture though it was not heard", () => {
	const quiet = build()?.highlights?.rows.at(-1);
	assert.equal(quiet?.comName, "Hermit Thrush");
	assert.equal(quiet?.art?.kind, "painting");
});

test("there is no highlights image without a bird to highlight", () => {
	const images = build({ highlights: highlights.slice(0, 2) });
	assert.equal(images?.highlights, null);
	assert.ok(images?.topBirds);
});

test("both images share the title, station, collage and stats", () => {
	const images = build();
	assert.equal(images?.highlights?.title, images?.topBirds.title);
	assert.equal(images?.highlights?.stationName, images?.topBirds.stationName);
	assert.equal(images?.highlights?.collage, images?.topBirds.collage);
	assert.deepEqual(images?.highlights?.stats, images?.topBirds.stats);
});

test("a painted bird carries its painting and bounds", () => {
	const art = build()?.topBirds.rows[0].art;
	assert.equal(art?.kind, "painting");
	assert.match(art?.url ?? "", /^\/illustrations\/cardinalis-cardinalis\.webp/);
});

test("the collage shows every painted bird, the same for the same seed", () => {
	const collage = build()?.topBirds.collage;
	assert.deepEqual(
		collage?.map((bird) => [bird.comName, bird.kind]),
		input.birds.map((bird) => [bird.comName, "painting"]),
	);
	assert.deepEqual(build()?.topBirds.collage, collage);
});

test("with no painted birds the collage falls back to photos", () => {
	assert.deepEqual(
		build({
			birds: [{ comName: "Test Bird", sciName: "Avis ignota", count: 3 }],
		})?.topBirds.collage.map((bird) => bird.kind),
		["photo"],
	);
});

test("the title reads like the Timeline page header", () => {
	assert.equal(build()?.topBirds.title, "Daily — Nov 18");
	assert.equal(build({ heading: ["All Time"] })?.topBirds.title, "All Time");
});

test("the two images save under different names", () => {
	assert.equal(
		build()?.topBirds.fileName,
		"songbook-daily-nov-18-top-birds.png",
	);
	assert.equal(
		build()?.highlights?.fileName,
		"songbook-daily-nov-18-highlights.png",
	);
});

test("the alt text says what the image shows", () => {
	assert.equal(
		build({ birds: input.birds.slice(0, 1) })?.topBirds.alt,
		"Daily — Nov 18. Blue Jay 40. Detections 1,234, Species 7, Peak hour 6 AM",
	);
	assert.match(build()?.highlights?.alt ?? "", /New: House Finch, Regular:/);
});

test("the stats read detections, species and the peak hour", () => {
	assert.deepEqual(build()?.topBirds.stats, [
		{ label: "Detections", value: "1,234" },
		{ label: "Species", value: "7" },
		{ label: "Peak hour", value: "6 AM" },
	]);
	assert.equal(build({ peakHour: null })?.topBirds.stats.length, 2);
});

test("there is no image when nothing was heard", () => {
	assert.equal(build({ birds: [] }), null);
	assert.equal(build({ detections: 0 }), null);
});

test("a blank station name is left off", () => {
	assert.equal(build({ stationName: "  " })?.topBirds.stationName, null);
});

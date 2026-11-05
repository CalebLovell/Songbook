import assert from "node:assert/strict";
import { test } from "node:test";

import { speciesFuse } from "./species-fuse.ts";

const species = [
	{ comName: "Red-bellied Woodpecker", sciName: "Melanerpes carolinus" },
	{ comName: "Red-headed Woodpecker", sciName: "Melanerpes erythrocephalus" },
	{ comName: "Downy Woodpecker", sciName: "Dryobates pubescens" },
	{ comName: "Black-capped Chickadee", sciName: "Poecile atricapillus" },
	{ comName: "Carolina Wren", sciName: "Thryothorus ludovicianus" },
];

const search = (query: string) =>
	speciesFuse(species)
		.search(query)
		.map((result) => result.item.comName);

test("a full species name finds that species and not its look-alike", () => {
	assert.deepEqual(search("red-headed woodpecker"), ["Red-headed Woodpecker"]);
	assert.deepEqual(search("red-bellied woodpecker"), [
		"Red-bellied Woodpecker",
	]);
});

test("a missing hyphen still finds the species", () => {
	assert.deepEqual(search("red headed woodpecker"), ["Red-headed Woodpecker"]);
});

test("one typo in a longer word still finds the species", () => {
	assert.deepEqual(search("chikadee"), ["Black-capped Chickadee"]);
	assert.equal(search("wodpecker").length, 3);
});

test("a word anywhere in the name matches", () => {
	assert.deepEqual(search("wren"), ["Carolina Wren"]);
	assert.equal(search("woodpecker").length, 3);
});

test("a scientific name matches", () => {
	assert.deepEqual(search("poecile"), ["Black-capped Chickadee"]);
});

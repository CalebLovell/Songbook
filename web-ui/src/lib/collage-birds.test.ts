import assert from "node:assert/strict";
import { test } from "node:test";

import {
	type CollageBird,
	collagePhotosFrom,
	flyingNames,
} from "~/lib/collage-birds.ts";

const painting = {
	imageUrl: "/x.webp",
	bounds: [0, 0, 1, 1] as [number, number, number, number],
};
const birds: CollageBird[] = Array.from({ length: 40 }, (_, i) => ({
	comName: `bird-${String(i).padStart(2, "0")}`,
	sciName: `bird ${i}`,
	count: 1000 - i * 20,
	perched: painting,
	flight: painting,
}));

test("a quarter of the birds fly", () => {
	assert.equal(flyingNames(birds, 1).size, 10);
});

test("fliers spread across the sizes, whatever the draw", () => {
	for (let seed = 0; seed < 50; seed++) {
		const ranks = [...flyingNames(birds, seed)]
			.map((name) => Number(name.slice(5)))
			.sort((a, b) => a - b);
		for (let i = 0; i < ranks.length; i++) {
			assert.ok(ranks[i] >= i * 4 && ranks[i] < (i + 1) * 4);
		}
	}
});

test("a bird with no flight painting never flies", () => {
	const grounded = birds.map((bird, i) =>
		i % 2 ? { ...bird, flight: null } : bird,
	);
	for (const name of flyingNames(grounded, 7)) {
		assert.equal(Number(name.slice(5)) % 2, 0);
	}
});

test("a reshuffle changes which birds fly", () => {
	const draws = new Set(
		Array.from({ length: 10 }, (_, seed) =>
			[...flyingNames(birds, seed)].join(),
		),
	);
	assert.ok(draws.size > 1);
});

test("a photo station gets every bird as a photo tile", () => {
	const species = [
		{ comName: "Blue Jay", sciName: "Cyanocitta cristata", count: 40 },
		{ comName: "Mystery Bird", sciName: "Nonesuch nonesuch", count: 2 },
	];
	const tiles = collagePhotosFrom(species);
	assert.equal(tiles.length, 2);
	assert.ok(tiles.every((tile) => tile.kind === "photo"));
	assert.equal(tiles[1].imageUrl, null);
});

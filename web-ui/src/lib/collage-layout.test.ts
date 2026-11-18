import assert from "node:assert/strict";
import { test } from "node:test";

import {
	type CollageTile,
	layoutCollage,
	ownerAt,
} from "~/lib/collage-layout.ts";

function disc(size: number): CollageTile["mask"] {
	const filled = new Uint8Array(size * size);
	const r = size / 2;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			if ((x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r)
				filled[y * size + x] = 1;
		}
	}
	return { width: size, height: size, filled };
}

const tiles: CollageTile[] = Array.from({ length: 40 }, (_, i) => ({
	key: `bird-${i}`,
	count: (40 - i) ** 2,
	mask: disc(24),
}));

test("every bird fits inside the area", () => {
	const layout = layoutCollage(tiles, 900, 500);
	assert.equal(layout.placements.length, tiles.length);
	for (const p of layout.placements) {
		assert.ok(p.x >= 0 && p.y >= 0);
		assert.ok(p.x + p.width <= 900 && p.y + p.height <= 500);
	}
});

test("louder birds are drawn larger", () => {
	const layout = layoutCollage(tiles, 900, 500);
	const area = (key: string) => {
		const p = layout.placements.find((placement) => placement.key === key);
		return p ? p.width * p.height : 0;
	};
	assert.ok(area("bird-0") > area("bird-39"));
});

test("the pointer finds the bird under it", () => {
	const layout = layoutCollage(tiles.slice(0, 1), 400, 400);
	const [only] = layout.placements;
	assert.equal(
		ownerAt(layout, only.x + only.width / 2, only.y + only.height / 2),
		0,
	);
	assert.equal(ownerAt(layout, 1, 1), -1);
});

test("a phone-width area still fits everyone", () => {
	const layout = layoutCollage(tiles, 340, 600);
	assert.equal(layout.placements.length, tiles.length);
});

test("no two birds touch side by side", () => {
	const layout = layoutCollage(tiles, 900, 500);
	const { owners, columns } = layout;
	for (let i = 0; i < owners.length; i++) {
		const owner = owners[i];
		if (owner < 0) continue;
		for (const j of [i + 1, i + columns]) {
			if (j % columns === 0 && j === i + 1) continue;
			const other = owners[j] ?? -1;
			assert.ok(other < 0 || other === owner);
		}
	}
});

test("the flock fills most of the area", () => {
	const layout = layoutCollage(tiles, 900, 500);
	let filled = 0;
	for (const owner of layout.owners) if (owner >= 0) filled++;
	assert.ok(filled / layout.owners.length > 0.35);
});

test("the flock reaches the card's edges on at least one axis", () => {
	for (const [width, height] of [
		[900, 500],
		[340, 600],
	]) {
		const { placements } = layoutCollage(tiles, width, height);
		const left = Math.min(...placements.map((p) => p.x));
		const right = Math.max(...placements.map((p) => p.x + p.width));
		const top = Math.min(...placements.map((p) => p.y));
		const bottom = Math.max(...placements.map((p) => p.y + p.height));
		assert.ok(
			left >= -1 && top >= -1 && right <= width + 1 && bottom <= height + 1,
		);
		assert.ok(right - left > width * 0.95 || bottom - top > height * 0.95);
	}
});

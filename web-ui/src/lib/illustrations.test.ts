import assert from "node:assert/strict";
import test from "node:test";

import {
	illustrationUrlFor,
	isPhotoUrl,
	paintedBoundsFor,
	photoInPlaceOfPainting,
} from "./illustrations.ts";

const PHOTO = "https://inaturalist-open-data.s3.amazonaws.com/x.jpg";

test("painting wins over photo", () => {
	const photos = { "cardinalis-cardinalis": PHOTO };
	assert.equal(
		illustrationUrlFor("Cardinalis cardinalis", "perched", photos),
		"/illustrations/cardinalis-cardinalis.webp",
	);
});

test("unpainted species falls back to photo", () => {
	const photos = { "turdus-nonexistens": PHOTO };
	assert.equal(
		illustrationUrlFor("Turdus nonexistens", "perched", photos),
		PHOTO,
	);
	assert.equal(
		illustrationUrlFor("Turdus nonexistens", "flight", photos),
		PHOTO,
	);
});

test("unknown species is null", () => {
	assert.equal(illustrationUrlFor("Turdus nonexistens", "perched", {}), null);
});

test("isPhotoUrl tells photos from paintings", () => {
	assert.equal(isPhotoUrl(PHOTO), true);
	assert.equal(isPhotoUrl("/illustrations/x.webp"), false);
});

test("a release version is part of the painting URL, so a repaint is fetched anew", () => {
	assert.equal(
		illustrationUrlFor("Cardinalis cardinalis", "perched", {}, "1.48.0"),
		"/illustrations/cardinalis-cardinalis.webp?v=1.48.0",
	);
	assert.equal(
		illustrationUrlFor(
			"Turdus nonexistens",
			"perched",
			{ "turdus-nonexistens": PHOTO },
			"1.48.0",
		),
		PHOTO,
	);
});

test("a versioned painting URL still finds its bounds and its photo", () => {
	const url = "/illustrations/cardinalis-cardinalis.webp?v=1.48.0";
	assert.deepEqual(
		paintedBoundsFor(url),
		paintedBoundsFor("/illustrations/cardinalis-cardinalis.webp"),
	);
	assert.notEqual(paintedBoundsFor(url), null);
	assert.equal(
		photoInPlaceOfPainting("/illustrations/x-2.webp?v=1", { x: PHOTO }),
		PHOTO,
	);
});

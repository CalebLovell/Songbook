import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
	ArtworkPreferenceContext,
	SpeciesImage,
} from "~/components/species-image.tsx";
import type { ArtworkPreference } from "~/lib/illustrations.ts";

const render = (imageUrl: string | null, cropToPainting = false) =>
	renderToStaticMarkup(
		<SpeciesImage
			imageUrl={imageUrl}
			alt="Robin"
			glyphClassName="size-5"
			cropToPainting={cropToPainting}
		/>,
	);

test("a painting renders as an img that is not cropped to fill", () => {
	const html = render("/illustrations/x.webp");
	assert.match(html, /<img /);
	assert.doesNotMatch(html, /object-cover/);
});

test("a photo URL renders a square-cropped, referrer-free img", () => {
	const html = render("https://upload.wikimedia.org/x.jpg");
	assert.match(html, /<img /);
	assert.match(html, /object-cover/);
	assert.match(html, /rounded-md/);
	assert.match(html, /aspect-square/);
	assert.doesNotMatch(html, /size-full/);
	assert.match(html, /referrerpolicy="no-referrer"/i);
});

test("a photo ignores cropToPainting", () => {
	const html = render("https://upload.wikimedia.org/x.jpg", true);
	assert.match(html, /<img /);
	assert.doesNotMatch(html, /<svg/);
});

const renderPreferring = (preference: ArtworkPreference, imageUrl: string) =>
	renderToStaticMarkup(
		<ArtworkPreferenceContext.Provider value={preference}>
			<SpeciesImage imageUrl={imageUrl} alt="Robin" glyphClassName="size-5" />
		</ArtworkPreferenceContext.Provider>,
	);

test("preferring photos swaps a painting for its photo, in either pose", () => {
	for (const painting of ["turdus-migratorius", "turdus-migratorius-2"]) {
		const html = renderPreferring("photos", `/illustrations/${painting}.webp`);
		assert.match(html, /src="\/photos\/turdus-migratorius\.webp"/);
		assert.match(html, /object-cover/);
	}
});

test("preferring illustrations keeps the painting", () => {
	const html = renderPreferring(
		"illustrations",
		"/illustrations/turdus-migratorius.webp",
	);
	assert.match(html, /src="\/illustrations\/turdus-migratorius\.webp"/);
});

test("preferring photos keeps a painting that has no photo", () => {
	const html = renderPreferring("photos", "/illustrations/x.webp");
	assert.match(html, /src="\/illustrations\/x\.webp"/);
});

test("no image renders the glyph svg", () => {
	const html = render(null);
	assert.match(html, /<svg/);
	assert.doesNotMatch(html, /<img /);
});

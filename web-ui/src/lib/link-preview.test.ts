import assert from "node:assert/strict";
import test from "node:test";

import {
	defaultPreviewImage,
	pageHead,
	previewImageMeta,
	speciesPreviewImage,
} from "~/lib/link-preview.ts";

const ORIGIN = "https://station.example";

const content = (
	meta: ReturnType<typeof previewImageMeta>,
	key: string,
): string | undefined =>
	meta.find((tag) => ("name" in tag ? tag.name : tag.property) === key)
		?.content;

test("the default image is a wide card on the station's own origin", () => {
	const meta = previewImageMeta(defaultPreviewImage(ORIGIN));
	assert.equal(content(meta, "og:image"), `${ORIGIN}/og-image.png`);
	assert.equal(content(meta, "twitter:card"), "summary_large_image");
});

test("a painted species uses its square painting and the square card", () => {
	const image = speciesPreviewImage(
		ORIGIN,
		"Northern Cardinal",
		"Cardinalis cardinalis",
	);
	assert.ok(image);
	const meta = previewImageMeta(image);
	assert.equal(
		content(meta, "og:image"),
		`${ORIGIN}/illustrations-new/previews/cardinalis-cardinalis.jpg`,
	);
	assert.equal(content(meta, "og:image:width"), "400");
	assert.equal(content(meta, "twitter:card"), "summary");
});

test("a photographed species keeps the photo's own absolute address", () => {
	const image = speciesPreviewImage(ORIGIN, "Wood Duck", "Aix sponsa");
	assert.ok(image);
	const meta = previewImageMeta(image);
	assert.match(content(meta, "og:image") ?? "", /^https:\/\/inaturalist/);
	assert.equal(content(meta, "og:image:width"), undefined);
});

test("a species with no picture falls back to the default", () => {
	assert.equal(speciesPreviewImage(ORIGIN, "Nobody", "Nullus nullus"), null);
});

test("pageHead puts the description in both tags", () => {
	const { meta } = pageHead("Live", "Heard just now.");
	assert.deepEqual(meta[0], { title: "Songbook – Live" });
	assert.ok(
		meta.some(
			(tag) =>
				"property" in tag &&
				tag.property === "og:description" &&
				tag.content === "Heard just now.",
		),
	);
});

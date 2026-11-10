import assert from "node:assert/strict";
import { test } from "node:test";

import { detectionWorkspaceSearchSchema } from "./detection-workspace.ts";
import { reviewSearchSchema } from "./review-data.ts";
import { parseSearch } from "./search-params.ts";
import { speciesFilterWorkspaceSearchSchema } from "./species-filter-workspace.ts";

const detections = (url: string) =>
	detectionWorkspaceSearchSchema.parse(parseSearch(url));
const speciesFilter = (url: string) =>
	speciesFilterWorkspaceSearchSchema.parse(parseSearch(url));

test("an empty detections URL gets the default view", () => {
	const search = detections("");
	assert.equal(search.page, 1);
	assert.equal(search.sort, "recorded");
	assert.equal(search.direction, "desc");
	assert.equal(search.species, undefined);
});

test("bad detections parameters fall back instead of failing the page", () => {
	const search = detections(
		"?page=-3&sort=nope&direction=up&from=soon&to=2026",
	);
	assert.equal(search.page, 1);
	assert.equal(search.sort, "recorded");
	assert.equal(search.direction, "desc");
	assert.equal(search.from, undefined);
	assert.equal(search.to, undefined);
});

test("valid detections parameters are kept", () => {
	const search = detections(
		"?page=4&sort=species&direction=asc&from=2026-01-02&to=2026-03-04",
	);
	assert.equal(search.page, 4);
	assert.equal(search.sort, "species");
	assert.equal(search.direction, "asc");
	assert.equal(search.from, "2026-01-02");
	assert.equal(search.to, "2026-03-04");
});

test("the removed page size and confidence parameters are ignored", () => {
	const search = detections("?pageSize=25&minConfidence=0.8");
	assert.equal("pageSize" in search, false);
	assert.equal("minConfidence" in search, false);
});

test("a numeric detections search stays searchable as text", () => {
	assert.equal(detections("?species=95").species, "95");
});

test("a detections search is trimmed, and blank means no search", () => {
	assert.equal(detections("?species=%20wren%20").species, "wren");
	assert.equal(detections("?species=%20%20").species, undefined);
});

test("species filter defaults to ascending species", () => {
	const search = speciesFilter("");
	assert.equal(search.page, 1);
	assert.equal(search.sort, "species");
	assert.equal(search.direction, "asc");
	assert.equal(search.query, undefined);
});

test("species filter keeps a valid view and rejects a bad one", () => {
	const kept = speciesFilter("?page=3&sort=count&direction=desc&query=wren");
	assert.equal(kept.page, 3);
	assert.equal(kept.sort, "count");
	assert.equal(kept.direction, "desc");
	assert.equal(kept.query, "wren");
	const rejected = speciesFilter("?page=0&sort=nope&direction=up");
	assert.equal(rejected.page, 1);
	assert.equal(rejected.sort, "species");
	assert.equal(rejected.direction, "asc");
});

test("the review queue falls back to its first page", () => {
	assert.equal(reviewSearchSchema.parse({ page: 2 }).page, 2);
	assert.equal(reviewSearchSchema.parse({ page: 0 }).page, 1);
	assert.equal(reviewSearchSchema.parse({ page: "x" }).page, 1);
	assert.equal(reviewSearchSchema.parse({}).page, 1);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { closestSitePage, sitePageFor } from "~/lib/site-pages.ts";

test("a near-miss address suggests the page it was meant to be", () => {
	assert.equal(closestSitePage("/detection")?.to, "/detections");
	assert.equal(closestSitePage("/Timelime")?.to, "/timeline");
	assert.equal(closestSitePage("/bird")?.to, "/birds");
	assert.equal(closestSitePage("/setings/audio")?.to, "/settings");
});

test("an address that resembles no page suggests nothing", () => {
	assert.equal(closestSitePage("/"), undefined);
	assert.equal(closestSitePage("/zzz"), undefined);
	assert.equal(closestSitePage("/live-ish-thing"), undefined);
});

test("a short slug tolerates fewer typos than a long one", () => {
	assert.equal(closestSitePage("/lve")?.to, "/live");
	assert.equal(closestSitePage("/lv"), undefined);
});

test("an error page wears the header of the section it happened in", () => {
	assert.equal(sitePageFor("/")?.to, "/live");
	assert.equal(sitePageFor("/birds/northern-cardinal")?.to, "/birds");
	assert.equal(sitePageFor("/species-filter")?.header.title, "Species Filter");
	assert.equal(sitePageFor("/sign-in"), undefined);
});

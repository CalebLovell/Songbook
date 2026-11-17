import assert from "node:assert/strict";
import test from "node:test";

import {
	DEFAULT_REVIEW_RARE_SPECIES_MAX,
	parseSettingsCard,
} from "./settings-data.ts";

test("accepts inclusive detector boundaries", () => {
	const settings = parseSettingsCard("detection", {
		speciesFrequencyThreshold: 0.0005,
		confidence: 0.99,
		sensitivity: 0.5,
		overlap: 2.9,
		privacyThreshold: 3,
	});
	assert.equal(settings.speciesFrequencyThreshold, 0.0005);
	assert.equal(settings.confidence, 0.99);
	assert.equal(settings.sensitivity, 0.5);
	assert.equal(settings.overlap, 2.9);
});

test("rejects detector values outside their supported ranges", () => {
	const valid = {
		speciesFrequencyThreshold: 0.03,
		confidence: 0.7,
		sensitivity: 1.25,
		overlap: 0,
		privacyThreshold: 0,
	};
	assert.doesNotThrow(() => parseSettingsCard("detection", valid));
	assert.throws(() =>
		parseSettingsCard("detection", { ...valid, privacyThreshold: 3.1 }),
	);
	assert.throws(() =>
		parseSettingsCard("detection", { ...valid, confidence: 1 }),
	);
	assert.throws(() =>
		parseSettingsCard("detection", { ...valid, sensitivity: 1.51 }),
	);
	assert.throws(() =>
		parseSettingsCard("detection", {
			...valid,
			speciesFrequencyThreshold: 0.0004,
		}),
	);
	assert.throws(() => parseSettingsCard("detection", { ...valid, overlap: 3 }));
});

test("validates station coordinates, timezone, and safe text", () => {
	assert.deepEqual(
		parseSettingsCard("station", {
			siteName: "Creek North",
			latitude: 90,
			longitude: -180,
			timezone: "America/Chicago",
		}),
		{
			siteName: "Creek North",
			latitude: 90,
			longitude: -180,
			timezone: "America/Chicago",
		},
	);
	assert.throws(() =>
		parseSettingsCard("station", {
			siteName: "Bad\nName",
			latitude: 0,
			longitude: 0,
			timezone: "America/Chicago",
		}),
	);
	assert.throws(() =>
		parseSettingsCard("station", {
			siteName: "Station",
			latitude: 90.1,
			longitude: 0,
			timezone: "Not/A_Zone",
		}),
	);
});

test("enforces storage boundaries", () => {
	assert.deepEqual(
		parseSettingsCard("storage", {
			fullDiskAction: "purge",
			purgeThreshold: 99,
			maxFilesPerSpecies: 0,
			keepPerSpecies: 10,
		}),
		{
			fullDiskAction: "purge",
			purgeThreshold: 99,
			maxFilesPerSpecies: 0,
			keepPerSpecies: 10,
		},
	);
	assert.throws(() =>
		parseSettingsCard("storage", {
			fullDiskAction: "delete-everything",
			purgeThreshold: 19,
			maxFilesPerSpecies: -1,
			keepPerSpecies: -1,
		}),
	);
});

test("defaults Review rarity to ten and rejects zero", () => {
	assert.equal(DEFAULT_REVIEW_RARE_SPECIES_MAX, 10);
	assert.deepEqual(parseSettingsCard("review", {}), { rareSpeciesMax: 10 });
	assert.throws(() => parseSettingsCard("review", { rareSpeciesMax: 0 }));
});

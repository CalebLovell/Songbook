import assert from "node:assert/strict";
import test from "node:test";

import { parseSettingsCard } from "./settings-data.ts";

test("accepts inclusive detector boundaries", () => {
	const settings = parseSettingsCard("detection", {
		confidence: 0.99,
		sensitivity: 0.5,
		overlap: 2.9,
		privacyThreshold: 3,
	});
	assert.equal(settings.confidence, 0.99);
	assert.equal(settings.sensitivity, 0.5);
	assert.equal(settings.overlap, 2.9);
});

test("rejects detector values outside their supported ranges", () => {
	const valid = {
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

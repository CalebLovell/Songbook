import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
	isUnauthorizedError,
	requireUnlocked,
	UnauthorizedError,
} from "./auth.ts";
import { deleteDetections } from "./detections.ts";
import { getStationHealth } from "./health.ts";
import {
	confirmReviewDetection,
	deleteReviewDetection,
	getReviewPage,
	getReviewSpecies,
	recategorizeReviewDetection,
} from "./review.ts";
import {
	getSettingsPage,
	resetSettingsFn,
	restartStationFn,
	saveAudioSettingsFn,
	saveDetectionSettingsFn,
	saveRecordingSettingsFn,
	saveReviewSettingsFn,
	saveStationSettingsFn,
	saveStorageSettingsFn,
} from "./settings.ts";
import { getSpeciesFilterPage, saveSpeciesFilter } from "./species-filter.ts";
import { powerStationFn } from "./station-power.ts";

function sourceOf(relativePath: string) {
	return readFileSync(
		fileURLToPath(new URL(relativePath, import.meta.url)),
		"utf8",
	);
}

function assertGated(source: string, name: string) {
	const start = source.indexOf(`export const ${name} =`);
	assert.ok(start !== -1, `${name} not found in source`);
	const nextExport = source.indexOf("\nexport const", start + 1);
	const body = source.slice(start, nextExport === -1 ? undefined : nextExport);
	assert.ok(
		body.includes(".middleware([requireUnlocked])"),
		`${name} is not gated`,
	);
}

test("every gated server function carries requireUnlocked", () => {
	void requireUnlocked;
	void saveSpeciesFilter;
	void resetSettingsFn;
	void restartStationFn;
	void saveAudioSettingsFn;
	void saveDetectionSettingsFn;
	void saveRecordingSettingsFn;
	void saveReviewSettingsFn;
	void saveStationSettingsFn;
	void saveStorageSettingsFn;
	void confirmReviewDetection;
	void deleteReviewDetection;
	void recategorizeReviewDetection;
	void getReviewPage;
	void getReviewSpecies;
	void getSettingsPage;
	void getSpeciesFilterPage;
	void getStationHealth;
	void deleteDetections;

	const settingsSource = sourceOf("./settings.ts");
	for (const name of [
		"saveStationSettingsFn",
		"saveDetectionSettingsFn",
		"saveAudioSettingsFn",
		"saveRecordingSettingsFn",
		"saveStorageSettingsFn",
		"saveReviewSettingsFn",
		"resetSettingsFn",
		"restartStationFn",
		"getSettingsPage",
	]) {
		assertGated(settingsSource, name);
	}

	const speciesFilterSource = sourceOf("./species-filter.ts");
	for (const name of ["saveSpeciesFilter", "getSpeciesFilterPage"]) {
		assertGated(speciesFilterSource, name);
	}

	const reviewSource = sourceOf("./review.ts");
	for (const name of [
		"confirmReviewDetection",
		"recategorizeReviewDetection",
		"deleteReviewDetection",
		"getReviewPage",
		"getReviewSpecies",
	]) {
		assertGated(reviewSource, name);
	}

	assertGated(sourceOf("./health.ts"), "getStationHealth");

	void powerStationFn;
	assertGated(sourceOf("./station-power.ts"), "powerStationFn");

	assertGated(sourceOf("./detections.ts"), "deleteDetections");
});

test("the gate's refusal is recognised after losing its class", () => {
	assert.equal(isUnauthorizedError(new UnauthorizedError()), true);
	assert.equal(
		isUnauthorizedError(new Error(new UnauthorizedError().message)),
		true,
	);
	assert.equal(isUnauthorizedError(new Error("database is locked")), false);
	assert.equal(
		isUnauthorizedError("This page requires the station password."),
		false,
	);
});

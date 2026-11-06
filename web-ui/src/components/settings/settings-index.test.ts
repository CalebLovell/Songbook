import assert from "node:assert/strict";
import { test } from "node:test";

import {
	SETTINGS_INDEX,
	SETTINGS_SECTIONS,
	SETTINGS_TABS,
	settingsCardId,
} from "./settings-index.ts";

test("every settings tab has exactly one section, in tab order", () => {
	assert.deepEqual(
		SETTINGS_SECTIONS.map((section) => section.tab),
		[...SETTINGS_TABS],
	);
});

test("a card outside Preferences has its tab as its anchor id", () => {
	for (const entry of SETTINGS_INDEX) {
		if (entry.tab !== "preferences")
			assert.equal(entry.tab, settingsCardId(entry.title));
	}
});

test("search finds Preferences' cards by their own names", () => {
	const titles = SETTINGS_INDEX.filter(
		(entry) => entry.tab === "preferences",
	).map((entry) => entry.title);
	assert.deepEqual(titles, ["Artwork", "Highlights", "Review"]);
});

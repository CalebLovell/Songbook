import assert from "node:assert/strict";
import { test } from "node:test";

import {
	SETTINGS_INDEX,
	SETTINGS_TABS,
	settingsCardId,
} from "./settings-index.ts";

test("every settings tab has exactly one card, in tab order", () => {
	assert.deepEqual(
		SETTINGS_INDEX.map((entry) => entry.tab),
		[...SETTINGS_TABS],
	);
});

test("a card's tab is its anchor id", () => {
	for (const entry of SETTINGS_INDEX) {
		assert.equal(entry.tab, settingsCardId(entry.title));
	}
});

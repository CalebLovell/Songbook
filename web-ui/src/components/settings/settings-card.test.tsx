import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";

import {
	PREFERENCE_DEFAULTS,
	type PreferenceSettings,
} from "~/lib/settings-data.ts";

import { SettingsCard } from "./settings-card.tsx";

const done = async (values: PreferenceSettings) => ({
	status: "saved" as const,
	message: "",
	values,
});

const ACTIONS = { save: done, reset: () => done(PREFERENCE_DEFAULTS) };

function render(initial: PreferenceSettings) {
	return renderToStaticMarkup(
		<QueryClientProvider client={new QueryClient()}>
			<SettingsCard initial={initial} actions={ACTIONS} />
		</QueryClientProvider>,
	);
}

function button(markup: string, label: string) {
	return new RegExp(`<button(?:(?!<button).)*?${label}</button>`, "s").exec(
		markup,
	)?.[0];
}

test("one card holds every preference, with a single Rare", () => {
	const markup = render(PREFERENCE_DEFAULTS);
	assert.equal(markup.match(/<section/g)?.length, 1);
	assert.equal(markup.match(/>Rare</g)?.length, 1);
	for (const label of ["Show birds as", "Boost quiet recordings", "Vocal"])
		assert.ok(markup.includes(label), label);
});

test("Reset and Save do nothing while the card holds the defaults", () => {
	const markup = render(PREFERENCE_DEFAULTS);
	assert.match(button(markup, "Reset settings") ?? "", /disabled=""/);
	assert.match(button(markup, "Save") ?? "", /disabled=""/);
});

test("Reset is live once a saved value differs from its default", () => {
	const markup = render({
		...PREFERENCE_DEFAULTS,
		highlights: { ...PREFERENCE_DEFAULTS.highlights, rareMax: 12 },
	});
	assert.doesNotMatch(button(markup, "Reset settings") ?? "", /disabled=""/);
});

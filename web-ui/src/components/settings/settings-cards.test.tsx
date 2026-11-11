import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
	SETTINGS_DEFAULTS,
	type SettingsPageData,
} from "~/lib/settings-data.ts";

import { SettingsCards, type SettingsSavers } from "./settings-cards.tsx";

const DATA: SettingsPageData = {
	...SETTINGS_DEFAULTS,
	station: { siteName: "", latitude: 45, longitude: -75, timezone: "UTC" },
	supportedTimezones: ["UTC"],
	updates: { automatic: true },
} as SettingsPageData;

const saved = async <T,>(values: T) => ({
	status: "saved" as const,
	message: "",
	values,
});

const SAVERS = {
	station: saved,
	detection: saved,
	audio: saved,
	recording: saved,
	storage: saved,
	review: saved,
	highlights: saved,
	updates: saved,
} as unknown as SettingsSavers;

function renderWithQueryClient(element: ReactNode) {
	return renderToStaticMarkup(
		<QueryClientProvider client={new QueryClient()}>
			{element}
		</QueryClientProvider>,
	);
}

function cardMarkup(markup: string, id: string) {
	const start = markup.indexOf(`id="${id}"`);
	assert.notEqual(start, -1);
	const end = markup.indexOf("</section>", start);
	return markup.slice(start, end);
}

function resetButton(card: string) {
	return /<button(?:(?!<button).)*?Reset these settings<\/button>/s.exec(
		card,
	)?.[0];
}

test("every card with a default offers its own reset; Updates doesn't", () => {
	const markup = renderWithQueryClient(
		<SettingsCards tab="detection" data={DATA} savers={SAVERS} />,
	);
	for (const id of [
		"detection",
		"audio-input",
		"recording",
		"storage",
		"review",
		"highlights",
		"artwork",
	]) {
		assert.ok(resetButton(cardMarkup(markup, id)), id);
	}
});

test("a card's reset does nothing while it already holds the defaults", () => {
	const markup = renderWithQueryClient(
		<SettingsCards tab="storage" data={DATA} savers={SAVERS} />,
	);
	assert.match(resetButton(cardMarkup(markup, "storage")) ?? "", /disabled=""/);
});

test("a card's reset is live once a value differs from the default", () => {
	const markup = renderWithQueryClient(
		<SettingsCards
			tab="storage"
			data={{
				...DATA,
				storage: { ...DATA.storage, purgeThreshold: 80 },
			}}
			savers={SAVERS}
		/>,
	);
	assert.doesNotMatch(
		resetButton(cardMarkup(markup, "storage")) ?? "",
		/disabled=""/,
	);
});

test("a card's footer runs reset first and Save last", () => {
	const markup = renderWithQueryClient(
		<SettingsCards tab="storage" data={DATA} savers={SAVERS} />,
	);
	const card = cardMarkup(markup, "storage");
	assert.ok(card.indexOf("Reset these settings") < card.indexOf(">Save<"));
	assert.match(card, /ml-auto[^>]*>(?:(?!<\/button>).)*type="submit"/s);
});

test("Save and reset look disabled while there is nothing to do", () => {
	const markup = renderWithQueryClient(
		<SettingsCards tab="storage" data={DATA} savers={SAVERS} />,
	);
	const save = /<button[^>]*type="submit"[^>]*>/.exec(
		cardMarkup(markup, "storage"),
	)?.[0];
	const reset = resetButton(cardMarkup(markup, "storage"));
	for (const button of [save, reset]) {
		assert.match(button ?? "", /disabled=""/);
		assert.match(button ?? "", /disabled:opacity-50/);
	}
});

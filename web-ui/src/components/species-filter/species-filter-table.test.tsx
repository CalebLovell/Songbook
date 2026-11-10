import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { SpeciesSelectionBar } from "~/components/species-filter/species-filter-page.tsx";
import { SpeciesFilterTable } from "~/components/species-filter/species-filter-table.tsx";

const html = renderToStaticMarkup(
	<SpeciesFilterTable
		rows={[]}
		page={1}
		pageCount={3}
		selected={new Set()}
		sort="species"
		direction="asc"
		onSortChange={() => {}}
		onSelectedChange={() => {}}
		onPageChange={() => {}}
		actions={<fieldset aria-label="Selected species" />}
	/>,
);

const bar = renderToStaticMarkup(
	<SpeciesSelectionBar count={2} onClear={() => {}} onStatus={() => {}} />,
);

test("the footer runs range, selection actions, then stepper", () => {
	const range = html.indexOf("1–0");
	const actions = html.indexOf('aria-label="Selected species"');
	const stepper = html.indexOf('aria-label="Species pages"');
	assert.ok(range >= 0 && actions >= 0 && stepper >= 0);
	assert.ok(range < actions);
	assert.ok(actions < stepper);
});

test("the footer stays on one line", () => {
	const footer = html.match(/<div class="([^"]*border-t[^"]*)"/)?.[1];
	assert.ok(footer);
	assert.doesNotMatch(footer, /flex-wrap/);
});

test("the selection actions stand no taller than the stepper", () => {
	assert.match(bar, /<fieldset[^>]*class="[^"]*\bh-8\s/);
});

test("a narrow card offers every status through one select", () => {
	const select = bar.match(/<select[\s\S]*<\/select>/)?.[0] ?? "";
	for (const label of [
		"Automatic",
		"Custom",
		"Always detect",
		"Never detect",
	]) {
		assert.match(select, new RegExp(`>${label}</option>`));
	}
});

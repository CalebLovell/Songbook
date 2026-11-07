import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { DetectionsTable } from "~/components/detections/detections-table.tsx";

const html = renderToStaticMarkup(
	<DetectionsTable
		page={{ rows: [], total: 0 }}
		search={{ page: 1, sort: "recorded", direction: "desc" }}
		onSearchChange={() => {}}
		rowSelection={{ "1": true }}
		onRowSelectionChange={() => {}}
		canDelete
		canListen={false}
		onDeleteSelected={() => {}}
	/>,
);

test("the footer runs range, selection actions, then stepper", () => {
	const range = html.indexOf("1–0");
	const actions = html.indexOf('aria-label="Selected detections"');
	const stepper = html.indexOf('aria-label="Detections pages"');
	assert.ok(range >= 0 && actions >= 0 && stepper >= 0);
	assert.ok(range < actions);
	assert.ok(actions < stepper);
});

test("the selection actions stand no taller than the stepper", () => {
	assert.match(
		html,
		/<fieldset aria-label="Selected detections" class="[^"]*\bh-8\s/,
	);
});

test("the count, clear and delete all stay on the smallest screens", () => {
	const bar = html.match(
		/<fieldset aria-label="Selected detections"[\s\S]*?<\/fieldset>/,
	)?.[0];
	assert.ok(bar);
	assert.doesNotMatch(bar, /max-\[\d+px\]:hidden/);
});

test("the footer stays on one line", () => {
	const footer = html.match(/<div class="([^"]*border-t[^"]*)"/)?.[1];
	assert.ok(footer);
	assert.doesNotMatch(footer, /flex-wrap/);
});

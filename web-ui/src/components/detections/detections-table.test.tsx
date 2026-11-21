import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { DetectionsTable } from "~/components/detections/detections-table.tsx";
import type { DetectionTableRow } from "~/lib/detections.ts";

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

test("signed in, rows carry no links", () => {
	const row = {
		rowId: 1,
		Date: "2026-11-20",
		Time: "14:46:00",
		Sci_Name: "Dryobates villosus",
		Com_Name: "Hairy Woodpecker",
		Confidence: 0.71,
		File_Name: "hairy.mp3",
	} as DetectionTableRow;
	const signedIn = renderToStaticMarkup(
		<DetectionsTable
			page={{ rows: [row], total: 1 }}
			search={{ page: 1, sort: "recorded", direction: "desc" }}
			onSearchChange={() => {}}
			rowSelection={{}}
			onRowSelectionChange={() => {}}
			canDelete
			canListen={false}
			onDeleteSelected={() => {}}
		/>,
	);
	const body = signedIn.match(/<tbody[\s\S]*<\/tbody>/)?.[0];
	assert.ok(body);
	assert.match(body, /Hairy Woodpecker/);
	assert.doesNotMatch(body, /<a\s/);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import type { MouseEvent } from "react";

import { selectableRowProps } from "~/components/ui/row-checkbox.tsx";

function clickOn(ownControl: string | null, selection = "") {
	globalThis.window = {
		getSelection: () => ({ toString: () => selection }),
	} as unknown as Window & typeof globalThis;
	let toggled = 0;
	const { onClick } = selectableRowProps(() => {
		toggled += 1;
	});
	onClick({
		target: { closest: () => ownControl },
	} as unknown as MouseEvent<HTMLElement>);
	return toggled;
}

test("a click anywhere on the row toggles it", () => {
	assert.equal(clickOn(null), 1);
});

test("a click on the row's own controls leaves the toggle to them", () => {
	assert.equal(clickOn("button"), 0);
});

test("dragging to select text does not toggle the row", () => {
	assert.equal(clickOn(null, "Hairy"), 0);
});

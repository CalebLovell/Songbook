import assert from "node:assert/strict";
import { test } from "node:test";

import { cn } from "./utils.ts";

test("cn resolves the named spacing tokens against the numeric scale", () => {
	assert.equal(cn("gap-2", "gap-page"), "gap-page");
	assert.equal(cn("p-page", "p-0"), "p-0");
	assert.equal(cn("-mx-4", "-mx-page"), "-mx-page");
	assert.equal(cn("px-1", "px-cell"), "px-cell");
	assert.equal(cn("pr-1", "pr-page-end"), "pr-page-end");
	assert.equal(cn("pr-1", "pr-card-edge"), "pr-card-edge");
	assert.equal(cn("min-h-4", "min-h-masthead"), "min-h-masthead");
	assert.equal(cn("size-4", "size-row-checkbox"), "size-row-checkbox");
});

test("cn resolves the named colour tokens against each other", () => {
	assert.equal(cn("bg-card", "bg-meadow"), "bg-meadow");
	assert.equal(cn("text-sm", "text-moss"), "text-sm text-moss");
	assert.equal(cn("border", "border-line"), "border border-line");
});

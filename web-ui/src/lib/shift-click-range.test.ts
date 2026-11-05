import assert from "node:assert/strict";
import test from "node:test";

import { rowsInShiftClick } from "./shift-click-range.ts";

const orderedIds = ["a", "b", "c", "d", "e"];
const lastClick = (clickedId: string, rows = [clickedId]) => ({
	clickedId,
	rows,
});

test("a plain click changes only the clicked row", () => {
	assert.deepEqual(rowsInShiftClick(orderedIds, lastClick("a"), "d", false), [
		"d",
	]);
});

test("a shift-click reaches back to the last clicked row", () => {
	assert.deepEqual(rowsInShiftClick(orderedIds, lastClick("b"), "d", true), [
		"b",
		"c",
		"d",
	]);
});

test("a shift-click works up the table as well as down", () => {
	assert.deepEqual(rowsInShiftClick(orderedIds, lastClick("d"), "b", true), [
		"b",
		"c",
		"d",
	]);
});

test("a shift-click with no earlier click changes only the clicked row", () => {
	assert.deepEqual(rowsInShiftClick(orderedIds, null, "c", true), ["c"]);
});

test("a shift-click ignores an earlier row that has left the table", () => {
	assert.deepEqual(rowsInShiftClick(orderedIds, lastClick("gone"), "c", true), [
		"c",
	]);
});

test("a repeated shift-click on the same row covers the same range", () => {
	const range = ["b", "c", "d"];
	assert.deepEqual(
		rowsInShiftClick(orderedIds, lastClick("d", range), "d", true),
		range,
	);
});

test("a plain click on the same row still changes only that row", () => {
	const range = ["b", "c", "d"];
	assert.deepEqual(
		rowsInShiftClick(orderedIds, lastClick("d", range), "d", false),
		["d"],
	);
});

test("a repeated shift-click skips rows that have left the table", () => {
	assert.deepEqual(
		rowsInShiftClick(orderedIds, lastClick("d", ["gone", "c", "d"]), "d", true),
		["c", "d"],
	);
});

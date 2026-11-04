import assert from "node:assert/strict";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const SOURCE_ROOT = path.resolve(import.meta.dirname, "..");

function sources(): { file: string; text: string }[] {
	return globSync("{lib,routes,components}/**/*.{ts,tsx}", {
		cwd: SOURCE_ROOT,
	})
		.filter((file) => !/\.test\.tsx?$/.test(file))
		.map((file) => ({
			file,
			text: readFileSync(path.join(SOURCE_ROOT, file), "utf8"),
		}));
}

test("the scan covers the module that serves the public detections table", () => {
	const scanned = sources().map(({ file }) => file.replaceAll("\\", "/"));
	assert.ok(scanned.includes("lib/detections.ts"));
});

test("nothing reads a detection's coordinates", () => {
	for (const { file, text } of sources()) {
		assert.doesNotMatch(text, /\bdetections\.(Lat|Lon)\b/, file);
		assert.doesNotMatch(text, /\bSELECT\b[^;`"]*\b(Lat|Lon)\b/i, file);
	}
});

test("nothing selects every column of the detections table", () => {
	for (const { file, text } of sources()) {
		assert.doesNotMatch(text, /\bdb\s*\.select\(\s*\)/, file);
		assert.doesNotMatch(text, /getTableColumns\(\s*detections\s*\)/, file);
		assert.doesNotMatch(text, /SELECT\s+\*\s+FROM\s+detections/i, file);
	}
});

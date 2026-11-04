import assert from "node:assert/strict";
import { test } from "node:test";

import type { z } from "zod";

import { Route as BirdsRoute } from "~/routes/birds.index.tsx";
import { Route as TimelineRoute } from "~/routes/timeline.tsx";

import { parseSearch, stringifySearch } from "./search-params.ts";

function validated(
	route: { options: { validateSearch?: unknown } },
	search: Record<string, unknown>,
) {
	const schema = route.options.validateSearch as z.ZodType<
		Record<string, unknown>
	>;
	return schema.parse(parseSearch(stringifySearch(search)));
}

test("a numeric-looking string is written to the URL unquoted", () => {
	assert.equal(stringifySearch({ date: "2026" }), "?date=2026");
});

test("a bare year in the URL reaches the timeline as a string", () => {
	assert.equal(validated(TimelineRoute, { date: "2026" }).date, "2026");
});

test("a non-numeric date survives the round trip", () => {
	assert.equal(validated(TimelineRoute, { date: "2026-W31" }).date, "2026-W31");
});

test("a numeric species search reaches the birds page as a string", () => {
	assert.equal(validated(BirdsRoute, { q: "1080" }).q, "1080");
});

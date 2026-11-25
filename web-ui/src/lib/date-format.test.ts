import assert from "node:assert/strict";
import test from "node:test";

import {
	formatDate,
	formatDateTime,
	formatInstant,
	formatTime,
} from "./date-format.ts";

function inTimeZone(t: test.TestContext, zone: string) {
	const before = process.env.TZ;
	t.after(() => {
		if (before === undefined) delete process.env.TZ;
		else process.env.TZ = before;
	});
	process.env.TZ = zone;
}

for (const zone of ["America/Los_Angeles", "UTC", "Pacific/Auckland"])
	test(`wall-clock times print as written in ${zone}`, (t) => {
		inTimeZone(t, zone);
		assert.equal(formatDate("2026-03-08"), "Mar 8, 2026");
		assert.equal(
			formatDateTime("2026-03-08", "02:30:00"),
			"Mar 8, 2026, 2:30 AM",
		);
		assert.equal(
			formatDateTime("2026-03-08 23:59:00"),
			"Mar 8, 2026, 11:59 PM",
		);
		assert.equal(formatTime("00:05:00"), "12:05 AM");
	});

test("an instant prints in the local zone", (t) => {
	inTimeZone(t, "America/Los_Angeles");
	assert.equal(
		formatInstant("2026-11-24T04:00:00.000Z"),
		"Nov 23, 2026, 8:00 PM",
	);
});

test("text that isn't a date prints unchanged", () => {
	assert.equal(formatDate("soon"), "soon");
	assert.equal(formatInstant("soon"), "soon");
});

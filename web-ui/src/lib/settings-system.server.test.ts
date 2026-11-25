import assert from "node:assert/strict";
import test from "node:test";

import {
	runCardSystemActions,
	type SettingsCommandRunner,
} from "./settings-system.server.ts";

function recordingRunner(calls: unknown[]): SettingsCommandRunner {
	return async (executable, args, stdin) => {
		calls.push({ executable, args: [...args], stdin });
	};
}

test("each card can invoke only its allowlisted services", async () => {
	const expected = {
		station: ["birdnet_analysis.service"],
		detection: ["birdnet_analysis.service"],
		artwork: [],
	} as const;
	for (const [kind, services] of Object.entries(expected)) {
		const calls: { args: string[] }[] = [];
		await runCardSystemActions(
			kind as keyof typeof expected,
			{},
			async (_executable, args) => {
				calls.push({ args: [...args] });
			},
		);
		assert.deepEqual(
			calls,
			services.length ? [{ args: ["systemctl", "restart", ...services] }] : [],
			kind,
		);
	}
});

test("Station applies a changed timezone without constructing a shell command", async () => {
	const calls: unknown[] = [];
	await runCardSystemActions(
		"station",
		{
			previousTimezone: "America/Denver",
			timezone: "America/Chicago",
			timezoneFileExists: true,
		},
		recordingRunner(calls),
	);
	assert.deepEqual(calls, [
		{
			executable: "sudo",
			args: ["timedatectl", "set-timezone", "America/Chicago"],
			stdin: undefined,
		},
		{
			executable: "sudo",
			args: ["tee", "/etc/timezone"],
			stdin: "America/Chicago\n",
		},
		{
			executable: "sudo",
			args: ["systemctl", "restart", "birdnet_analysis.service"],
			stdin: undefined,
		},
	]);
});

test("a changed timezone reaches the running web UI", async (t) => {
	const before = process.env.TZ;
	t.after(() => {
		if (before === undefined) delete process.env.TZ;
		else process.env.TZ = before;
	});
	process.env.TZ = "America/New_York";
	const runningTimezone = () =>
		Intl.DateTimeFormat().resolvedOptions().timeZone;
	assert.equal(runningTimezone(), "America/New_York");

	await runCardSystemActions(
		"station",
		{
			previousTimezone: "America/New_York",
			timezone: "America/Chicago",
			timezoneFileExists: false,
		},
		recordingRunner([]),
	);
	assert.equal(runningTimezone(), "America/Chicago");
	assert.equal(new Date("2026-01-01T12:00:00Z").getHours(), 6);
});

test("a refused timezone leaves the running web UI alone", async () => {
	const before = Intl.DateTimeFormat().resolvedOptions().timeZone;
	await assert.rejects(
		runCardSystemActions(
			"station",
			{
				previousTimezone: before,
				timezone: "Pacific/Auckland",
				timezoneFileExists: false,
			},
			async () => {
				throw new Error("refused");
			},
		),
	);
	assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, before);
});

test("Station skips timezone commands when it did not change", async () => {
	const calls: unknown[] = [];
	await runCardSystemActions(
		"station",
		{
			previousTimezone: "America/Chicago",
			timezone: "America/Chicago",
			timezoneFileExists: true,
		},
		recordingRunner(calls),
	);
	assert.deepEqual(calls, [
		{
			executable: "sudo",
			args: ["systemctl", "restart", "birdnet_analysis.service"],
			stdin: undefined,
		},
	]);
});

test("development can skip fixed system actions explicitly", async () => {
	const calls: unknown[] = [];
	const result = await runCardSystemActions(
		"detection",
		{ skipSystemActions: true },
		recordingRunner(calls),
	);
	assert.deepEqual(calls, []);
	assert.deepEqual(result, { attempted: false, skipped: true });
});

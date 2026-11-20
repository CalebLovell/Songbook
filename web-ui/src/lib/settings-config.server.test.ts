import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmod,
	lstat,
	mkdtemp,
	readdir,
	readFile,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
	parseBirdnetConfig,
	readHighlightThresholds,
	readSettingsPageValues,
	resolveSettingsPath,
	writeSettingsCard,
} from "./settings-config.server.ts";

async function fixtureConfig(contents: string) {
	const directory = await mkdtemp(path.join(tmpdir(), "birdnet-settings-"));
	const file = path.join(directory, "birdnet.conf");
	await writeFile(file, contents, "utf8");
	return file;
}

test("parses quoted, unquoted, and blank shell assignments", () => {
	const parsed = parseBirdnetConfig(
		[
			"# comment",
			'SITE_NAME="Creek \\"North\\""',
			"LATITUDE=41.25",
			"EXTRACTION_LENGTH=",
		].join("\n"),
	);
	assert.equal(parsed.SITE_NAME, 'Creek "North"');
	assert.equal(parsed.LATITUDE, "41.25");
	assert.equal(parsed.EXTRACTION_LENGTH, "");
});

test("uses BIRDNET_CONF before the production path", () => {
	const previous = process.env.BIRDNET_CONF;
	process.env.BIRDNET_CONF = "C:\\fixture\\birdnet.conf";
	try {
		assert.equal(resolveSettingsPath(), "C:\\fixture\\birdnet.conf");
	} finally {
		if (previous === undefined) delete process.env.BIRDNET_CONF;
		else process.env.BIRDNET_CONF = previous;
	}
	assert.equal(resolveSettingsPath(), previous ?? "/etc/birdnet/birdnet.conf");
});

test("updates only Station assignments and preserves the document", async () => {
	const before = [
		"# station",
		'SITE_NAME="Backyard"',
		"LATITUDE=41.0000",
		"LONGITUDE=-93.0000",
		"BIRDWEATHER_ID=secret-that-must-survive",
		'RTSP_STREAM="rtsp://bird:secret@camera/live"',
		"",
	].join("\n");
	const file = await fixtureConfig(before);
	await chmod(file, 0o640);
	const originalMode = (await stat(file)).mode & 0o777;
	await writeSettingsCard(
		"station",
		{
			siteName: 'Creek "North"',
			latitude: 42.25,
			longitude: -92.75,
			timezone: "America/Chicago",
		},
		file,
	);
	const after = await readFile(file, "utf8");
	assert.match(after, /^# station/m);
	assert.match(after, /^SITE_NAME="Creek \\"North\\""$/m);
	assert.match(after, /^LATITUDE=42.25$/m);
	assert.match(after, /^LONGITUDE=-92.75$/m);
	assert.match(after, /^BIRDWEATHER_ID=secret-that-must-survive$/m);
	assert.match(after, /^RTSP_STREAM="rtsp:\/\/bird:secret@camera\/live"$/m);
	assert.equal((await stat(file)).mode & 0o777, originalMode);
	assert.deepEqual(await readdir(path.dirname(file)), ["birdnet.conf"]);
});

test("a guessed location stays guessed until the location itself is saved", async () => {
	const file = await fixtureConfig(
		[
			'SITE_NAME="Backyard Station"',
			"LATITUDE=45.5231",
			"LONGITUDE=-122.6765",
			"LOCATION_SOURCE=ip",
			'LOCATION_PLACE="Portland, Oregon, United States"',
			"",
		].join("\n"),
	);
	const guessed = (await readSettingsPageValues(file, "UTC")).station;
	assert.equal(guessed.locationConfirmed, false);

	await writeSettingsCard("station", { ...guessed, siteName: "Creek" }, file);
	let after = await readFile(file, "utf8");
	assert.match(after, /^LOCATION_SOURCE=ip$/m);
	assert.match(after, /^LOCATION_PLACE="Portland, Oregon, United States"$/m);

	await writeSettingsCard(
		"station",
		{ ...guessed, latitude: 45.6, locationConfirmed: true },
		file,
	);
	after = await readFile(file, "utf8");
	assert.match(after, /^LOCATION_SOURCE=user$/m);
	assert.match(after, /^LOCATION_PLACE=""$/m);
	assert.equal(
		(await readSettingsPageValues(file, "UTC")).station.locationConfirmed,
		true,
	);
});

test("a station without a location source counts as confirmed", async () => {
	const file = await fixtureConfig("LATITUDE=41.25\nLONGITUDE=-93\n");
	const { station } = await readSettingsPageValues(file, "UTC");
	assert.equal(station.locationConfirmed, true);
});

const SHELL_ACTIVE_NAMES = [
	"x$(echo RAN)",
	"x`echo RAN`",
	"cost $HOME",
	'quote " and back\\slash',
	"trailing\\",
];

async function saveSiteName(siteName: string, file: string) {
	await writeSettingsCard(
		"station",
		{ siteName, latitude: 1, longitude: 2, timezone: "America/Chicago" },
		file,
	);
}

test("bash reads a saved site name literally instead of running it", async (t) => {
	const probe = spawnSync("bash", ["-c", "echo ok"], { encoding: "utf8" });
	if (probe.stdout?.trim() !== "ok") {
		t.skip("bash isn't available");
		return;
	}
	for (const siteName of SHELL_ACTIVE_NAMES) {
		const file = await fixtureConfig('SITE_NAME="Backyard"\n');
		await saveSiteName(siteName, file);
		const sourced = spawnSync(
			"bash",
			["-c", 'source "$1" && printf %s "$SITE_NAME"', "probe", file],
			{ encoding: "utf8" },
		);
		assert.equal(sourced.stdout, siteName);
	}
});

test("a saved site name reads back unchanged in the web UI", async () => {
	for (const siteName of SHELL_ACTIVE_NAMES) {
		const file = await fixtureConfig('SITE_NAME="Backyard"\n');
		await saveSiteName(siteName, file);
		const parsed = parseBirdnetConfig(await readFile(file, "utf8"));
		assert.equal(parsed.SITE_NAME, siteName);
	}
});

test("replacement patterns in a value don't rewrite the rest of the file", async () => {
	const file = await fixtureConfig('BEFORE=1\nSITE_NAME="Backyard"\nAFTER=2\n');
	await saveSiteName("a$&b$'c$`d", file);
	const after = await readFile(file, "utf8");
	assert.equal(after.split("\n").length, 8);
	assert.equal(parseBirdnetConfig(after).SITE_NAME, "a$&b$'c$`d");
	assert.equal(parseBirdnetConfig(after).AFTER, "2");
});

test("saves through a symlinked config into the real file", async (t) => {
	const real = await fixtureConfig("CONFIDENCE=0.7\n");
	const linkDirectory = await mkdtemp(path.join(tmpdir(), "birdnet-etc-"));
	const link = path.join(linkDirectory, "birdnet.conf");
	try {
		await symlink(real, link);
	} catch {
		t.skip("this system can't make symlinks");
		return;
	}
	await chmod(linkDirectory, 0o555);
	try {
		await writeSettingsCard("playback", { boostQuietRecordings: false }, link);
	} finally {
		await chmod(linkDirectory, 0o755);
	}
	assert.match(await readFile(real, "utf8"), /^BOOST_QUIET_RECORDINGS=0$/m);
	assert.ok((await lstat(link)).isSymbolicLink());
	assert.deepEqual(await readdir(path.dirname(real)), ["birdnet.conf"]);
});

test("appends the Rare setting once and defaults older files", async () => {
	const file = await fixtureConfig("CONFIDENCE=0.7\n");
	assert.equal((await readHighlightThresholds(file)).rareMax, 5);
	const highlights = {
		rareMax: 12,
		returnedDays: 14,
		goneQuietDays: 7,
		regularDays: 7,
		vocalRatio: 3,
	};
	await writeSettingsCard("highlights", highlights, file);
	await writeSettingsCard("highlights", { ...highlights, rareMax: 14 }, file);
	const text = await readFile(file, "utf8");
	assert.equal(text.match(/^HIGHLIGHT_RARE_MAX=/gm)?.length, 1);
	assert.match(text, /^HIGHLIGHT_RARE_MAX=14$/m);
	assert.equal((await readHighlightThresholds(file)).rareMax, 14);
});

test("appends any key an older config never carried", async () => {
	const file = await fixtureConfig("BIRDWEATHER_ID=keep-me\n");
	await writeSettingsCard("playback", { boostQuietRecordings: false }, file);
	const text = await readFile(file, "utf8");
	assert.match(text, /^BIRDWEATHER_ID=keep-me$/m);
	assert.match(text, /^BOOST_QUIET_RECORDINGS=0$/m);
});

test("saving a card leaves the config-only audio, recording and storage values alone", async () => {
	const file = await fixtureConfig(
		[
			"REC_CARD=hw:1,0",
			"CHANNELS=1",
			'RTSP_STREAM="rtsp://one/live,rtsps://two/live"',
			"RTSP_STREAM_TO_LIVESTREAM=1",
			"RECORDING_LENGTH=15",
			"EXTRACTION_LENGTH=",
			"AUDIOFMT=mp3",
			"FULL_DISK=keep",
			"PURGE_THRESHOLD=80",
			"PURGE_KEEP_PER_SPECIES=3",
			"MAX_FILES_SPECIES=5",
		].join("\n"),
	);
	await writeSettingsCard(
		"detection",
		{
			confidence: 0.8,
			sensitivity: 1.25,
			overlap: 0,
			privacyThreshold: 0,
		},
		file,
	);
	const text = await readFile(file, "utf8");
	assert.match(text, /^REC_CARD=hw:1,0$/m);
	assert.match(text, /^CHANNELS=1$/m);
	assert.match(text, /^RTSP_STREAM="rtsp:\/\/one\/live,rtsps:\/\/two\/live"$/m);
	assert.match(text, /^RTSP_STREAM_TO_LIVESTREAM=1$/m);
	assert.match(text, /^RECORDING_LENGTH=15$/m);
	assert.match(text, /^EXTRACTION_LENGTH=$/m);
	assert.match(text, /^AUDIOFMT=mp3$/m);
	assert.match(text, /^FULL_DISK=keep$/m);
	assert.match(text, /^PURGE_THRESHOLD=80$/m);
	assert.match(text, /^PURGE_KEEP_PER_SPECIES=3$/m);
	assert.match(text, /^MAX_FILES_SPECIES=5$/m);
});

test("rejects newlines before writing configuration strings", async () => {
	const file = await fixtureConfig(
		'SITE_NAME="Backyard"\nLATITUDE=0\nLONGITUDE=0\n',
	);
	await assert.rejects(
		writeSettingsCard(
			"station",
			{
				siteName: "Injected\nFULL_DISK=keep",
				latitude: 0,
				longitude: 0,
				timezone: "America/Chicago",
			},
			file,
		),
	);
	assert.equal(
		await readFile(file, "utf8"),
		'SITE_NAME="Backyard"\nLATITUDE=0\nLONGITUDE=0\n',
	);
});

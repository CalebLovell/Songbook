import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { loadStationHealth } from "./health.server.ts";
import { BOOT_GRACE_SECONDS } from "./health-data.ts";

const SETTLED = BOOT_GRACE_SECONDS + 1;

let root: string;
let streamData: string;
let conf: string;
let previousConf: string | undefined;

before(async () => {
	root = await mkdtemp(path.join(tmpdir(), "songbook-health-"));
	streamData = path.join(root, "StreamData");
	conf = path.join(root, "birdnet.conf");
	await mkdir(streamData);
	previousConf = process.env.BIRDNET_CONF;
	process.env.BIRDNET_CONF = conf;
});

after(async () => {
	if (previousConf === undefined) delete process.env.BIRDNET_CONF;
	else process.env.BIRDNET_CONF = previousConf;
	await rm(root, { recursive: true, force: true });
});

function kinds(health: { toDos: { kind: string }[] }) {
	return health.toDos.map((toDo) => toDo.kind);
}

test("a station with recent audio and a location has no file-based to-dos", async () => {
	await writeFile(conf, `LATITUDE=45.5\nLONGITUDE=-75.1\nRECS_DIR=${root}\n`);
	const health = await loadStationHealth({ uptimeSeconds: SETTLED });
	assert.deepEqual(
		kinds(health).filter((kind) => kind !== "disk" && kind !== "analyzer"),
		[],
	);
});

test("an old StreamData folder and a zero location are reported", async () => {
	await writeFile(
		conf,
		`LATITUDE=0.0000\nLONGITUDE=0.0000\nRECS_DIR=${root}\n`,
	);
	const hourAgo = new Date(Date.now() - 3_600_000);
	await utimes(streamData, hourAgo, hourAgo);
	const health = await loadStationHealth({ uptimeSeconds: SETTLED });
	assert.ok(kinds(health).includes("location"));
	assert.ok(kinds(health).includes("audio"));
});

test("a station still named after its host is reported", async () => {
	await writeFile(conf, `SITE_NAME="${hostname()}"\n`);
	const health = await loadStationHealth({ uptimeSeconds: SETTLED });
	assert.ok(kinds(health).includes("name"));
});

test("a just-booted station doesn't report stale audio", async () => {
	await writeFile(conf, `LATITUDE=45.5\nLONGITUDE=-75.1\nRECS_DIR=${root}\n`);
	const hourAgo = new Date(Date.now() - 3_600_000);
	await utimes(streamData, hourAgo, hourAgo);
	const health = await loadStationHealth({ uptimeSeconds: 30 });
	assert.ok(!kinds(health).includes("audio"));
});

test("a missing StreamData folder is unknown, not a to-do", async () => {
	await writeFile(
		conf,
		`LATITUDE=45.5\nLONGITUDE=-75.1\nRECS_DIR=${path.join(root, "nowhere")}\n`,
	);
	const health = await loadStationHealth({ uptimeSeconds: SETTLED });
	assert.ok(!kinds(health).includes("audio"));
});

test("an unreadable config is unknown, not a to-do", async () => {
	await rm(conf, { force: true });
	const health = await loadStationHealth({ uptimeSeconds: SETTLED });
	assert.deepEqual(
		kinds(health).filter((kind) => kind !== "analyzer"),
		[],
	);
});

import assert from "node:assert/strict";
import test from "node:test";

import { shareRead } from "./shared-read.ts";

function counted() {
	let reads = 0;
	let clock = 0;
	let version = 1;
	const finishes: ((value: string) => void)[] = [];
	const read = () => {
		reads += 1;
		return new Promise<string>((resolve) => finishes.push(resolve));
	};
	return {
		shared: shareRead(read, {
			maxAgeMs: 1_000,
			version: () => version,
			now: () => clock,
		}),
		reads: () => reads,
		finish: (value: string) => finishes.shift()?.(value),
		advance: (ms: number) => {
			clock += ms;
		},
		commit: () => {
			version += 1;
		},
	};
}

test("callers during a read share it", async () => {
	const { shared, reads, finish } = counted();
	const answers = [shared(), shared(), shared()];
	finish("live");
	assert.deepEqual(await Promise.all(answers), ["live", "live", "live"]);
	assert.equal(reads(), 1);
});

test("a read answers until it reaches its maximum age, then reads again", async () => {
	const { shared, reads, finish, advance } = counted();
	const first = shared();
	finish("live");
	await first;

	advance(999);
	assert.equal(await shared(), "live");
	assert.equal(reads(), 1);

	advance(1);
	const second = shared();
	assert.equal(reads(), 2);
	finish("offline");
	assert.equal(await second, "offline");
});

test("a new version reads again before the maximum age", async () => {
	const { shared, reads, finish, commit } = counted();
	const first = shared();
	finish("before");
	await first;

	commit();
	const second = shared();
	assert.equal(reads(), 2);
	finish("after");
	assert.equal(await second, "after");
});

test("a commit during a read is picked up by the next caller", async () => {
	const { shared, reads, finish, commit } = counted();
	const first = shared();
	commit();
	finish("before");
	await first;

	const second = shared();
	assert.equal(reads(), 2);
	finish("after");
	assert.equal(await second, "after");
});

test("a failed read is retried by the next caller", async () => {
	let reads = 0;
	const shared = shareRead(
		async () => {
			reads += 1;
			if (reads === 1) throw new Error("no answer");
			return "live";
		},
		{ maxAgeMs: 1_000 },
	);
	await assert.rejects(shared());
	assert.equal(await shared(), "live");
});

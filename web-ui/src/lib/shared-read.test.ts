import assert from "node:assert/strict";
import test from "node:test";

import { shareRead } from "./shared-read.ts";

function counted() {
	let reads = 0;
	let clock = 0;
	const finishes: ((value: string) => void)[] = [];
	const read = () => {
		reads += 1;
		return new Promise<string>((resolve) => finishes.push(resolve));
	};
	return {
		shared: shareRead(read, 1_000, () => clock),
		reads: () => reads,
		finish: (value: string) => finishes.shift()?.(value),
		advance: (ms: number) => {
			clock += ms;
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

test("a finished read answers until it expires, then reads again", async () => {
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

test("a failed read is retried by the next caller", async () => {
	let reads = 0;
	const shared = shareRead(async () => {
		reads += 1;
		if (reads === 1) throw new Error("no answer");
		return "live";
	}, 1_000);
	await assert.rejects(shared());
	assert.equal(await shared(), "live");
});

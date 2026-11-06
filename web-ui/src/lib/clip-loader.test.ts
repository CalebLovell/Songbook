import assert from "node:assert/strict";
import { test } from "node:test";

import { createClipLoader } from "~/lib/clip-loader.ts";

const FIRST = "/api/audio/first";
const SECOND = "/api/audio/second";

function harness() {
	const pending = new Map<string, (blob: Blob) => void>();
	const fetched: string[] = [];
	const revoked: string[] = [];
	const audio = { src: "" };
	const loading: boolean[] = [];
	const loader = createClipLoader({
		fetchClip: (url) => {
			fetched.push(url);
			return new Promise<Blob>((resolve, reject) => {
				pending.set(url, (blob) =>
					blob.size === 0 ? reject(new Error("failed")) : resolve(blob),
				);
			});
		},
		toObjectUrl: (blob) => `blob:${blob.type}`,
		revokeObjectUrl: (url) => revoked.push(url),
		onLoadingChange: (isLoading) => loading.push(isLoading),
	});
	const arrive = (url: string) =>
		pending.get(url)?.(new Blob(["clip"], { type: url }));
	const fail = (url: string) => pending.get(url)?.(new Blob());
	return { audio, loader, fetched, revoked, loading, arrive, fail };
}

test("a second press of the same clip reuses what was loaded", async () => {
	const { audio, loader, fetched, arrive } = harness();
	const first = loader.load(audio, FIRST);
	arrive(FIRST);
	assert.equal(await first, true);
	assert.equal(await loader.load(audio, FIRST), true);
	assert.deepEqual(fetched, [FIRST]);
});

test("a press after the clip changed loads the new clip", async () => {
	const { audio, loader, fetched, revoked, arrive } = harness();
	const first = loader.load(audio, FIRST);
	arrive(FIRST);
	await first;

	const second = loader.load(audio, SECOND);
	arrive(SECOND);
	assert.equal(await second, true);

	assert.deepEqual(fetched, [FIRST, SECOND]);
	assert.equal(audio.src, `blob:${SECOND}`);
	assert.deepEqual(revoked, [`blob:${FIRST}`]);
});

test("a slow older clip cannot overwrite the newer one", async () => {
	const { audio, loader, arrive, loading } = harness();
	const first = loader.load(audio, FIRST);
	const second = loader.load(audio, SECOND);

	arrive(SECOND);
	assert.equal(await second, true);
	assert.equal(loading.at(-1), false);

	arrive(FIRST);
	assert.equal(await first, false);
	assert.equal(audio.src, `blob:${SECOND}`);
});

test("a failed clip can be tried again", async () => {
	const { audio, loader, fetched, fail, arrive } = harness();
	const first = loader.load(audio, FIRST);
	fail(FIRST);
	assert.equal(await first, false);

	const retry = loader.load(audio, FIRST);
	arrive(FIRST);
	assert.equal(await retry, true);
	assert.deepEqual(fetched, [FIRST, FIRST]);
});

test("disposing frees the loaded clip", async () => {
	const { audio, loader, revoked, arrive } = harness();
	const first = loader.load(audio, FIRST);
	arrive(FIRST);
	await first;
	loader.dispose();
	assert.deepEqual(revoked, [`blob:${FIRST}`]);
});

import assert from "node:assert/strict";
import test from "node:test";

import { contentSecurityPolicy } from "./content-security-policy.ts";

function directives(policy: string) {
	return new Map(
		policy.split("; ").map((directive) => {
			const [name, ...sources] = directive.split(" ");
			return [name, sources.join(" ")] as const;
		}),
	);
}

test("production inline scripts need the request's nonce", () => {
	const policy = directives(
		contentSecurityPolicy({ nonce: "abc", dev: false }),
	);
	assert.doesNotMatch(policy.get("script-src") ?? "", /unsafe-inline/);
	assert.match(policy.get("script-src") ?? "", /'nonce-abc'/);
});

test("production blocks plugins, base rewrites, framing and outside connections", () => {
	const policy = directives(
		contentSecurityPolicy({ nonce: "abc", dev: false }),
	);
	assert.equal(policy.get("default-src"), "'self'");
	assert.equal(policy.get("object-src"), "'none'");
	assert.equal(policy.get("base-uri"), "'self'");
	assert.equal(policy.get("form-action"), "'self'");
	assert.equal(policy.get("frame-ancestors"), "'none'");
	assert.equal(policy.get("connect-src"), "'self'");
});

test("reference photos and in-memory clips still load", () => {
	const policy = directives(
		contentSecurityPolicy({ nonce: "abc", dev: false }),
	);
	assert.match(
		policy.get("img-src") ?? "",
		/https:\/\/inaturalist-open-data\.s3\.amazonaws\.com/,
	);
	assert.match(policy.get("media-src") ?? "", /blob:/);
});

test("the Cloudflare Web Analytics beacon is the only outside script allowed", () => {
	const policy = directives(
		contentSecurityPolicy({ nonce: "abc", dev: false }),
	);
	assert.equal(
		policy.get("script-src"),
		"'self' 'nonce-abc' https://static.cloudflareinsights.com",
	);
});

test("the dev server keeps its inline scripts and hot reload connection", () => {
	const policy = directives(contentSecurityPolicy({ nonce: "abc", dev: true }));
	assert.equal(policy.has("script-src"), false);
	assert.equal(policy.has("default-src"), false);
	assert.equal(policy.has("connect-src"), false);
	assert.equal(policy.get("frame-ancestors"), "'none'");
});

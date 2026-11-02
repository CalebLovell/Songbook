import "@tanstack/react-start/server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { AuthFile } from "./auth-file.server.ts";
import { SESSION_IDLE_DAYS } from "./auth-limits.ts";

export const UNLOCK_COOKIE_NAME = "birdnet_unlock";

/** Thirty days without a visit signs a browser out. A verified request
 *  re-issues the token with a fresh timestamp (at most once a day -- see
 *  `sessionNeedsRenewal`), so a device in regular use never falls out -- only
 *  a forgotten one does. Revocation before then is by password
 *  change or nonce rotation. */
const SESSION_IDLE_MS = SESSION_IDLE_DAYS * 24 * 60 * 60 * 1000;
export const COOKIE_MAX_AGE_SECONDS = SESSION_IDLE_MS / 1000;

const TOKEN_VERSION = "1";

/** Derived rather than stored: the key is a function of the password hash and
 *  the nonce, so changing either one silently invalidates every cookie in
 *  existence. That is the whole revocation mechanism. */
function signingKey(auth: AuthFile) {
	return createHash("sha256")
		.update(`${auth.hash}\u0000${auth.nonce}`)
		.digest();
}

function sign(auth: AuthFile, payload: string) {
	return createHmac("sha256", signingKey(auth))
		.update(payload)
		.digest("base64url");
}

export function signSessionToken(auth: AuthFile, issuedAt = Date.now()) {
	const payload = `${TOKEN_VERSION}.${issuedAt}`;
	return `${payload}.${sign(auth, payload)}`;
}

/** Long enough that a page of clips, each asking the gate, doesn't rewrite the
 *  cookie on every one; short against the thirty-day idle limit, so renewal
 *  still keeps a device in regular use signed in. */
const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

/** Whether a verified token is old enough to be re-issued. Only meaningful for
 *  a token `verifySessionToken` has accepted. */
export function sessionNeedsRenewal(token: string, now = Date.now()) {
	return now - Number(token.split(".")[1]) > RENEW_AFTER_MS;
}

export function verifySessionToken(
	auth: AuthFile,
	token: string | undefined,
	now = Date.now(),
) {
	if (!token) return false;

	const parts = token.split(".");
	if (parts.length !== 3) return false;

	const [version, issuedAt, signature] = parts;
	if (version !== TOKEN_VERSION || !/^\d+$/.test(issuedAt)) return false;
	// The cookie's own expiry is the browser's promise, not ours: a copied
	// token would outlive it. The timestamp is signed, so this is the check
	// that actually holds.
	if (now - Number(issuedAt) > SESSION_IDLE_MS) return false;

	const expected = Buffer.from(sign(auth, `${version}.${issuedAt}`), "utf8");
	const actual = Buffer.from(signature, "utf8");
	// timingSafeEqual throws on a length mismatch, which is itself a rejection.
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

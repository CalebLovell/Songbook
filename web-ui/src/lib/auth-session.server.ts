import "@tanstack/react-start/server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { AuthFile } from "./auth-file.server.ts";
import { SESSION_IDLE_DAYS } from "./auth-limits.ts";

export const UNLOCK_COOKIE_NAME = "birdnet_unlock";

const SESSION_IDLE_MS = SESSION_IDLE_DAYS * 24 * 60 * 60 * 1000;
export const COOKIE_MAX_AGE_SECONDS = SESSION_IDLE_MS / 1000;

const TOKEN_VERSION = "1";

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

const RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

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
	if (now - Number(issuedAt) > SESSION_IDLE_MS) return false;

	const expected = Buffer.from(sign(auth, `${version}.${issuedAt}`), "utf8");
	const actual = Buffer.from(signature, "utf8");
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

import "@tanstack/react-start/server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseBirdnetConfig } from "~/lib/settings-config.server.ts";

import { MIN_PASSWORD_LENGTH } from "./auth-limits.ts";

export { MIN_PASSWORD_LENGTH };

const SCRYPT = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;

export type AuthFile = { hash: string; nonce: string };

export class AuthConfigError extends Error {}

export function resolveAuthPath() {
	return process.env.BIRDNET_AUTH_CONF ?? "/etc/birdnet/web-ui/auth.conf";
}

export function hashPassword(password: string, salt = randomBytes(16)) {
	const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT);
	return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string) {
	const parts = stored.split("$");
	if (parts.length !== 6 || parts[0] !== "scrypt") return false;

	const [, n, r, p, saltB64, expectedB64] = parts;
	const cost = { N: Number(n), r: Number(r), p: Number(p) };
	if (!Object.values(cost).every(Number.isSafeInteger)) return false;
	if (cost.N > 1 << 20 || cost.r > 16 || cost.p > 4) return false;
	if (cost.N < 2 || cost.r < 1 || cost.p < 1) return false;

	const expected = Buffer.from(expectedB64, "base64");
	if (expected.length !== KEY_LENGTH) return false;

	try {
		const actual = scryptSync(
			password,
			Buffer.from(saltB64, "base64"),
			KEY_LENGTH,
			cost,
		);
		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

function serialize(auth: AuthFile) {
	return [
		"# Songbook web UI password. Do not edit by hand --",
		"# use scripts/set_web_ui_password.sh.",
		`WEB_UI_PWD_HASH=${auth.hash}`,
		`WEB_UI_SESSION_NONCE=${auth.nonce}`,
		"",
	].join("\n");
}

export async function writeAuthFile(
	next: AuthFile,
	authPath = resolveAuthPath(),
) {
	const temporaryPath = path.join(
		path.dirname(authPath),
		`.${path.basename(authPath)}.${process.pid}.tmp`,
	);
	await writeFile(temporaryPath, serialize(next), {
		encoding: "utf8",
		mode: 0o600,
	});
	try {
		await rename(temporaryPath, authPath);
	} catch (error) {
		await rm(temporaryPath, { force: true });
		throw error;
	}
}

export function newNonce() {
	return randomBytes(16).toString("hex");
}

export async function readAuthFile(
	authPath = resolveAuthPath(),
): Promise<AuthFile | null> {
	let text: string;
	try {
		text = await readFile(authPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw new AuthConfigError(
			`Cannot read ${authPath}: ${(error as Error).message}`,
		);
	}

	const values = parseBirdnetConfig(text);
	if (values.WEB_UI_PWD_IS_DEFAULT === "1") return null;

	const hash = values.WEB_UI_PWD_HASH ?? "";
	const nonce = values.WEB_UI_SESSION_NONCE ?? "";
	if (
		!/^scrypt\$\d+\$\d+\$\d+\$[^$]+\$[^$]+$/.test(hash) ||
		!/^[0-9a-f]{32}$/.test(nonce)
	) {
		throw new AuthConfigError(
			`${authPath} is malformed; the web UI stays locked.`,
		);
	}

	return { hash, nonce };
}

export async function changePassword(
	password: string,
	authPath = resolveAuthPath(),
) {
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new Error(
			`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
		);
	}
	await writeAuthFile(
		{ hash: hashPassword(password), nonce: newNonce() },
		authPath,
	);
}

import "@tanstack/react-start/server-only";

import {
	deleteCookie,
	getCookie,
	getRequestHeaders,
	getRequestIP,
	getRequestProtocol,
	setCookie,
} from "@tanstack/react-start/server";

import {
	AuthConfigError,
	type AuthFile,
	readAuthFile,
	resolveAuthPath,
	verifyPassword,
} from "./auth-file.server.ts";
import { clientAddress } from "./auth-policy.server.ts";
import {
	COOKIE_MAX_AGE_SECONDS,
	sessionNeedsRenewal,
	signSessionToken,
	UNLOCK_COOKIE_NAME,
	verifySessionToken,
} from "./auth-session.server.ts";
import { UnlockThrottle } from "./auth-throttle.server.ts";

type StationAuthState = "ready" | "not-set-up" | "misconfigured";
export type UnlockStatus = { unlocked: boolean; state: StationAuthState };
export type UnlockResult =
	| { ok: true }
	| {
			ok: false;
			reason: "invalid" | "throttled" | "not-set-up" | "misconfigured";
			retryAfterMs?: number;
	  };

type LoadedAuth =
	| { state: "ready"; auth: AuthFile }
	| { state: "not-set-up" | "misconfigured" };

async function loadAuth(): Promise<LoadedAuth> {
	try {
		const auth = await readAuthFile();
		return auth ? { state: "ready", auth } : { state: "not-set-up" };
	} catch (error) {
		if (!(error instanceof AuthConfigError)) throw error;
		console.error(`[auth] ${error.message}`);
		return { state: "misconfigured" };
	}
}

let throttle: UnlockThrottle | undefined;
function getThrottle() {
	if (!throttle) {
		throttle = new UnlockThrottle({
			statePath: `${resolveAuthPath()}.throttle.json`,
		});
	}
	return throttle;
}

function resolveClientIp() {
	return clientAddress(
		getRequestIP(),
		getRequestHeaders(),
		Boolean(process.env.WEB_UI_TRUSTED_PROXY),
	);
}

const UNKNOWN_CLIENT = "unknown";

function issueSession(auth: AuthFile) {
	setCookie(UNLOCK_COOKIE_NAME, signSessionToken(auth), {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		secure: getRequestProtocol() === "https",
		maxAge: COOKIE_MAX_AGE_SECONDS,
	});
}

export async function isSignedIn(): Promise<boolean> {
	try {
		return (await readUnlockStatus()).unlocked;
	} catch {
		return false;
	}
}

export async function readUnlockStatus(): Promise<UnlockStatus> {
	const loaded = await loadAuth();
	if (loaded.state !== "ready") return { unlocked: false, state: loaded.state };
	const { auth } = loaded;
	const token = getCookie(UNLOCK_COOKIE_NAME);
	const unlocked = verifySessionToken(auth, token);
	if (unlocked && token && sessionNeedsRenewal(token)) issueSession(auth);
	return { unlocked, state: "ready" };
}

export async function attemptUnlock(password: string): Promise<UnlockResult> {
	const loaded = await loadAuth();
	if (loaded.state !== "ready") return { ok: false, reason: loaded.state };
	const { auth } = loaded;
	const client = resolveClientIp() ?? UNKNOWN_CLIENT;
	const throttle = getThrottle();

	const gate = await throttle.check(client);
	if (!gate.allowed) {
		return { ok: false, reason: "throttled", retryAfterMs: gate.retryAfterMs };
	}

	if (!verifyPassword(password, auth.hash)) {
		await throttle.recordFailure(client);
		console.warn(`[auth] failed unlock from ${client}`);
		return { ok: false, reason: "invalid" };
	}

	await throttle.recordSuccess(client);
	issueSession(auth);
	return { ok: true };
}

export function clearSession() {
	deleteCookie(UNLOCK_COOKIE_NAME, { path: "/" });
}

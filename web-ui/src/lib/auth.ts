import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
	attemptUnlock,
	clearSession,
	readUnlockStatus,
	type UnlockStatus,
} from "./auth.server.ts";
import {
	readArtworkPreference,
	readSiteName,
} from "./settings-config.server.ts";

const UNAUTHORIZED_MESSAGE = "This page requires the station password.";

export class UnauthorizedError extends Error {
	override name = "UnauthorizedError";
	constructor() {
		super(UNAUTHORIZED_MESSAGE);
	}
}

export function isUnauthorizedError(error: unknown): boolean {
	return error instanceof Error && error.message === UNAUTHORIZED_MESSAGE;
}

export const requireUnlocked = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		let unlocked: boolean;
		try {
			({ unlocked } = await readUnlockStatus());
		} catch {
			unlocked = false;
		}
		if (!unlocked) throw new UnauthorizedError();
		return next();
	},
);

export const getUnlockStatusFn = createServerFn({ method: "GET" }).handler(
	async () => {
		let status: UnlockStatus;
		try {
			status = await readUnlockStatus();
		} catch (error) {
			console.error("[auth] could not read the unlock status", error);
			status = { unlocked: false, state: "misconfigured" };
		}
		return {
			...status,
			siteName: await readSiteName(),
			artwork: await readArtworkPreference(),
		};
	},
);

export const unlockFn = createServerFn({ method: "POST" })
	.validator(z.object({ password: z.string().max(1024) }))
	.handler(({ data }) => attemptUnlock(data.password));

export const lockFn = createServerFn({ method: "POST" }).handler(() => {
	clearSession();
	return { ok: true as const };
});

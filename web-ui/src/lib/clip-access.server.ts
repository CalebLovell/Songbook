import "@tanstack/react-start/server-only";

import { readUnlockStatus } from "~/lib/auth.server.ts";

export async function canHearEveryClip(): Promise<boolean> {
	try {
		return (await readUnlockStatus()).unlocked;
	} catch {
		return false;
	}
}

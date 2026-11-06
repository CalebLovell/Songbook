import "@tanstack/react-start/server-only";

import { sqlite } from "~/db/index.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import { readUnlockStatus } from "~/lib/auth.server.ts";
import {
	type BestRecording,
	bestRecordings,
} from "~/lib/best-recording.server.ts";
import { visitorRecordings } from "~/lib/voice-check.server.ts";

export async function canHearEveryClip(): Promise<boolean> {
	try {
		return (await readUnlockStatus()).unlocked;
	} catch {
		return false;
	}
}

export async function hearableRecordings(
	comName?: string,
): Promise<Map<string, BestRecording>> {
	return (await canHearEveryClip())
		? bestRecordings(sqlite, extractedDir(), comName)
		: visitorRecordings(comName);
}

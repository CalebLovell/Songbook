import "@tanstack/react-start/server-only";

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, setPriority } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

import { openWritableDetectionsDb, sqlite } from "~/db/index.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import {
	type BestRecording,
	checkUncheckedRecordings,
	publicRecordings,
} from "~/lib/best-recording.server.ts";
import { resolveDetectionClipPath } from "~/lib/detection-file-path.server.ts";

const LOWEST_PRIORITY = 19;
const CLIP_TIMEOUT_MS = 60_000;
const RETRY_AFTER_FAILURE_MS = 15 * 60_000;

let running = false;
let lastFailureAt = 0;

function voiceCheckScript(): string {
	const beside = path.resolve(
		path.dirname(process.argv[1] ?? ""),
		"../voice-check/voice_check.py",
	);
	return existsSync(beside)
		? beside
		: path.resolve("voice-check/voice_check.py");
}

function pythonPath(): string {
	return (
		process.env.BIRDNET_PYTHON ??
		path.join(homedir(), "BirdNET-Pi/birdnet/bin/python3")
	);
}

function startScorer(): {
	scoreClip: (clip: BestRecording) => Promise<number>;
	stop: () => void;
} {
	const child: ChildProcess = spawn(pythonPath(), [voiceCheckScript()], {
		shell: false,
		stdio: ["pipe", "pipe", "ignore"],
		windowsHide: true,
	});
	child.stdin?.on("error", () => {});
	if (child.pid !== undefined) {
		try {
			setPriority(child.pid, LOWEST_PRIORITY);
		} catch {}
	}

	const scores = createInterface({
		input: child.stdout as NodeJS.ReadableStream,
	});
	const lines = scores[Symbol.asyncIterator]();
	const exited = new Promise<never>((_, reject) => {
		child.once("error", reject);
		child.once("exit", () => reject(new Error("Voice check stopped")));
	});
	exited.catch(() => {});

	return {
		scoreClip: async (clip) => {
			const clipPath = resolveDetectionClipPath(extractedDir(), {
				date: clip.date,
				commonName: clip.comName,
				fileName: clip.fileName,
			});
			if (clipPath === null) throw new Error("Clip has no path");
			child.stdin?.write(`${clipPath}\n`);
			let timer: NodeJS.Timeout | undefined;
			const timedOut = new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error("Voice check timed out")),
					CLIP_TIMEOUT_MS,
				);
			});
			try {
				const line = await Promise.race([lines.next(), exited, timedOut]);
				if (line.done) throw new Error("Voice check stopped");
				return (JSON.parse(line.value) as { score: number }).score;
			} finally {
				clearTimeout(timer);
			}
		},
		stop: () => {
			scores.close();
			child.kill();
		},
	};
}

async function runVoiceChecks(): Promise<void> {
	const scorer = startScorer();
	const database = openWritableDetectionsDb();
	try {
		database.exec("PRAGMA busy_timeout = 5000");
		await checkUncheckedRecordings(database, extractedDir(), scorer.scoreClip);
	} finally {
		scorer.stop();
		database.close();
	}
}

function startVoiceChecks(): void {
	if (running || Date.now() - lastFailureAt < RETRY_AFTER_FAILURE_MS) return;
	running = true;
	runVoiceChecks()
		.catch(() => {
			lastFailureAt = Date.now();
		})
		.finally(() => {
			running = false;
		});
}

export function visitorRecordings(
	comName?: string,
): Map<string, BestRecording> {
	const { recordings, unchecked } = publicRecordings(
		sqlite,
		extractedDir(),
		comName,
	);
	if (unchecked.length > 0) startVoiceChecks();
	return recordings;
}

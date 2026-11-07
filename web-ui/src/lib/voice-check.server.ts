import "@tanstack/react-start/server-only";

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, setPriority } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

import { dataVersion, openWritableDetectionsDb, sqlite } from "~/db/index.ts";
import { extractedDir } from "~/lib/audio.server.ts";
import {
	type BestRecording,
	checkUncheckedRecordings,
	publicRecordings,
} from "~/lib/best-recording.server.ts";
import { resolveDetectionClipPath } from "~/lib/detection-file-path.server.ts";
import { shareRead } from "~/lib/shared-read.ts";

const LOWEST_PRIORITY = 19;
const CLIP_TIMEOUT_MS = 60_000;
const CHECK_INTERVAL_MS = 10 * 60_000;
// Clips can leave the disk without a commit, which puts the next-best clip in line,
// so an idle station still scans. Until then that clip only stays private.
const IDLE_SCAN_MAX_AGE_MS = 60 * 60_000;

let running = false;
let reportedMissingPython = false;

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

function isMissingPython(error: unknown): boolean {
	const { code, syscall } = error as NodeJS.ErrnoException;
	return code === "ENOENT" && syscall?.startsWith("spawn") === true;
}

function reportFailedCheck(error: unknown): void {
	if (!isMissingPython(error)) {
		console.error("[voice-check] a check failed:", error);
		return;
	}
	if (reportedMissingPython) return;
	reportedMissingPython = true;
	console.warn(
		`[voice-check] skipped, clips stay private: no Python at ${pythonPath()}. Set BIRDNET_PYTHON to run it.`,
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

async function runVoiceChecks(unchecked: BestRecording[]): Promise<void> {
	const scorer = startScorer();
	const database = openWritableDetectionsDb();
	try {
		database.exec("PRAGMA busy_timeout = 5000");
		await checkUncheckedRecordings(
			database,
			extractedDir(),
			scorer.scoreClip,
			unchecked,
		);
	} finally {
		scorer.stop();
		database.close();
	}
}

const scanForNewBestClips = shareRead(
	async () => {
		const { unchecked } = publicRecordings(sqlite, extractedDir());
		if (unchecked.length > 0) await runVoiceChecks(unchecked);
	},
	{ maxAgeMs: IDLE_SCAN_MAX_AGE_MS, version: dataVersion },
);

async function checkNewBestClips(): Promise<void> {
	if (running) return;
	running = true;
	try {
		await scanForNewBestClips();
	} catch (error) {
		reportFailedCheck(error);
	} finally {
		running = false;
	}
}

export function keepCheckingNewBestClips(): void {
	void checkNewBestClips();
	setInterval(() => void checkNewBestClips(), CHECK_INTERVAL_MS).unref();
}

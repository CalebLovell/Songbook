import "@tanstack/react-start/server-only";

import { open, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { Microphone } from "~/lib/health-data.ts";

const ASOUND_DIR = "/proc/asound";
const HEADER_BYTES = 512;
const SAMPLE_SECONDS = 3;
const MIN_SAMPLE_SECONDS = 1;
const NEWEST_RECORDINGS = 2;

export function parseCaptureDevices(cards: string, pcm: string): Microphone[] {
	const capturing = new Set<number>();
	for (const line of pcm.split("\n")) {
		const match = /^(\d+)-\d+:.*:\s*capture\s+\d+/.exec(line);
		if (match) capturing.add(Number(match[1]));
	}
	const lines = cards.split("\n");
	const microphones: Microphone[] = [];
	lines.forEach((line, index) => {
		const match = /^\s*(\d+)\s+\[([^\]]+?)\s*\]:\s*\S+\s+-\s+(.*)$/.exec(line);
		if (!match) return;
		const card = Number(match[1]);
		if (!capturing.has(card)) return;
		const longName = lines[index + 1]?.trim().replace(/ at .*$/, "");
		microphones.push({
			card,
			id: match[2],
			name: longName || match[3].trim(),
		});
	});
	return microphones;
}

export type WavFormat = {
	channels: number;
	sampleRate: number;
	bitsPerSample: number;
	dataOffset: number;
};

export function parseWavHeader(header: Buffer): WavFormat | null {
	if (header.length < 12) return null;
	if (header.toString("ascii", 0, 4) !== "RIFF") return null;
	if (header.toString("ascii", 8, 12) !== "WAVE") return null;
	let offset = 12;
	let format: Omit<WavFormat, "dataOffset"> | null = null;
	while (offset + 8 <= header.length) {
		const id = header.toString("ascii", offset, offset + 4);
		const size = header.readUInt32LE(offset + 4);
		const body = offset + 8;
		if (id === "fmt " && body + 16 <= header.length) {
			format = {
				channels: header.readUInt16LE(body + 2),
				sampleRate: header.readUInt32LE(body + 4),
				bitsPerSample: header.readUInt16LE(body + 14),
			};
		}
		if (id === "data") return format ? { ...format, dataOffset: body } : null;
		offset = body + size + (size % 2);
	}
	return null;
}

export function pcm16Peak(samples: Buffer): number | null {
	const count = Math.floor(samples.length / 2);
	if (count === 0) return null;
	let peak = 0;
	for (let index = 0; index < count; index++) {
		const value = Math.abs(samples.readInt16LE(index * 2));
		if (value > peak) peak = value;
	}
	return peak / 32_768;
}

export async function readMicrophones(
	asoundDir = ASOUND_DIR,
): Promise<Microphone[] | null> {
	try {
		const [cards, pcm] = await Promise.all([
			readFile(path.join(asoundDir, "cards"), "utf8"),
			readFile(path.join(asoundDir, "pcm"), "utf8").catch(() => ""),
		]);
		return parseCaptureDevices(cards, pcm);
	} catch {
		return null;
	}
}

async function recordingPeak(file: string): Promise<number | null> {
	const handle = await open(file, "r");
	try {
		const header = Buffer.alloc(HEADER_BYTES);
		const { bytesRead } = await handle.read(header, 0, HEADER_BYTES, 0);
		const format = parseWavHeader(header.subarray(0, bytesRead));
		if (format?.bitsPerSample !== 16 || format.channels < 1) return null;
		const bytesPerSecond = format.sampleRate * format.channels * 2;
		const { size } = await handle.stat();
		const available = size - format.dataOffset;
		if (available < bytesPerSecond * MIN_SAMPLE_SECONDS) return null;
		const blockAlign = format.channels * 2;
		const complete = available - (available % blockAlign);
		const wanted = Math.min(complete, bytesPerSecond * SAMPLE_SECONDS);
		const length = wanted - (wanted % blockAlign);
		const samples = Buffer.alloc(length);
		const start = format.dataOffset + complete - length;
		const read = await handle.read(samples, 0, length, start);
		return pcm16Peak(samples.subarray(0, read.bytesRead));
	} finally {
		await handle.close();
	}
}

export async function readSoundPeak(
	recsDir: string | undefined,
): Promise<number | null> {
	if (!recsDir) return null;
	const dir = path.join(recsDir, "StreamData");
	try {
		const names = (await readdir(dir)).filter((name) => name.endsWith(".wav"));
		const files = await Promise.all(
			names.map(async (name) => {
				const file = path.join(dir, name);
				try {
					return { file, mtimeMs: (await stat(file)).mtimeMs };
				} catch {
					return null;
				}
			}),
		);
		const newest = files
			.filter((each) => each !== null)
			.sort((a, b) => b.mtimeMs - a.mtimeMs)
			.slice(0, NEWEST_RECORDINGS);
		for (const { file } of newest) {
			try {
				const peak = await recordingPeak(file);
				if (peak !== null) return peak;
			} catch {}
		}
		return null;
	} catch {
		return null;
	}
}

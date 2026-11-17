import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import {
	parseCaptureDevices,
	parseWavHeader,
	pcm16Peak,
	readMicrophones,
	readSoundPeak,
} from "./audio-input.server.ts";

const PI_CARDS = ` 0 [Headphones     ]: bcm2835_headpho - bcm2835 Headphones
                      bcm2835 Headphones
 1 [Microphone     ]: USB-Audio - UAC 1.0 Microphone
                      KTMicro UAC 1.0 Microphone at usb-3f980000.usb-1.2, full speed
 2 [vc4hdmi        ]: vc4-hdmi - vc4-hdmi
                      vc4-hdmi
`;

const PI_PCM = `00-00: bcm2835 Headphones : bcm2835 Headphones : playback 8
01-00: USB Audio : USB Audio : capture 1
02-00: MAI PCM i2s-hifi-0 : MAI PCM i2s-hifi-0 : playback 1
`;

function wav(samples: number[], channels = 2, sampleRate = 48_000) {
	const data = Buffer.alloc(samples.length * 2);
	samples.forEach((value, index) => {
		data.writeInt16LE(value, index * 2);
	});
	const header = Buffer.alloc(44);
	header.write("RIFF", 0, "ascii");
	header.writeUInt32LE(0x7fffffff, 4);
	header.write("WAVE", 8, "ascii");
	header.write("fmt ", 12, "ascii");
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(channels, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(sampleRate * channels * 2, 28);
	header.writeUInt16LE(channels * 2, 32);
	header.writeUInt16LE(16, 34);
	header.write("data", 36, "ascii");
	header.writeUInt32LE(0x7fffffff, 40);
	return Buffer.concat([header, data]);
}

let root: string;

before(async () => {
	root = await mkdtemp(path.join(tmpdir(), "songbook-audio-"));
	await mkdir(path.join(root, "StreamData"));
});

after(async () => {
	await rm(root, { recursive: true, force: true });
});

test("only cards that can capture count as microphones", () => {
	assert.deepEqual(parseCaptureDevices(PI_CARDS, PI_PCM), [
		{ card: 1, id: "Microphone", name: "KTMicro UAC 1.0 Microphone" },
	]);
});

test("a Pi with nothing plugged in has no microphones", () => {
	assert.deepEqual(
		parseCaptureDevices(
			PI_CARDS,
			"00-00: bcm2835 Headphones : bcm2835 Headphones : playback 8\n",
		),
		[],
	);
});

test("an unreadable sound system is unknown, not empty", async () => {
	assert.equal(await readMicrophones(path.join(root, "nowhere")), null);
});

test("the wav header gives the format and where samples start", () => {
	assert.deepEqual(parseWavHeader(wav([0, 0])), {
		channels: 2,
		sampleRate: 48_000,
		bitsPerSample: 16,
		dataOffset: 44,
	});
	assert.equal(parseWavHeader(Buffer.from("not a wav")), null);
});

test("the peak is the loudest sample as a fraction of full scale", () => {
	const samples = Buffer.alloc(6);
	samples.writeInt16LE(100, 0);
	samples.writeInt16LE(-16_384, 2);
	samples.writeInt16LE(3, 4);
	assert.equal(pcm16Peak(samples), 0.5);
	assert.equal(pcm16Peak(Buffer.alloc(0)), null);
});

test("the newest recording's last seconds give the sound level", async () => {
	const second = 48_000 * 2;
	const loud = Array.from({ length: second * 2 }, (_, index) =>
		index === second ? 8_192 : 0,
	);
	await writeFile(path.join(root, "StreamData", "a.wav"), wav(loud));
	assert.equal(await readSoundPeak(root), 0.25);
});

test("a recording under a second long falls back to the one before", async () => {
	await writeFile(
		path.join(root, "StreamData", "b.wav"),
		wav(Array(1_000).fill(0)),
	);
	assert.equal(await readSoundPeak(root), 0.25);
});

test("silence reads as a zero peak", async () => {
	await rm(path.join(root, "StreamData"), { recursive: true });
	await mkdir(path.join(root, "StreamData"));
	await writeFile(
		path.join(root, "StreamData", "c.wav"),
		wav(Array(48_000 * 2 * 2).fill(0)),
	);
	assert.equal(await readSoundPeak(root), 0);
	assert.equal(await readSoundPeak(path.join(root, "nowhere")), null);
});

import { type ReactNode, useEffect, useRef, useState } from "react";

import { fftMagnitudes } from "~/lib/fft.ts";
import { fetchAudioBlob } from "~/lib/use-playable-audio.ts";

const FFT_SIZE = 1024;
const HOP = 256;
const MAX_HZ = 15000;
const DB_FLOOR = -95;
const DB_CEIL = -25;

const PAPER: [number, number, number] = [251, 253, 246];
const MOSS: [number, number, number] = [32, 59, 20];

const NOISE_WIDTH = 320;
const NOISE_HEIGHT = 100;
const NOISE_SEED = 7;

type RenderState = "loading" | "ready" | "empty";

export function Spectrogram({
	audioUrl,
	className,
	onDecoded,
	children,
}: {
	audioUrl: string;
	className?: string;
	onDecoded?: (seconds: number) => void;
	children?: ReactNode;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [state, setState] = useState<RenderState>("loading");
	const onDecodedRef = useRef(onDecoded);
	onDecodedRef.current = onDecoded;

	useEffect(() => {
		let cancelled = false;
		setState("loading");

		async function draw() {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const AudioCtx =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext?: typeof AudioContext })
					.webkitAudioContext;
			if (!AudioCtx) {
				setState("empty");
				return;
			}

			const context = new AudioCtx();
			try {
				const blob = await fetchAudioBlob(audioUrl);
				const buffer = await context.decodeAudioData(await blob.arrayBuffer());
				if (cancelled) return;
				paint(canvas, buffer);
				setState("ready");
				onDecodedRef.current?.(buffer.duration);
			} catch {
				if (!cancelled) setState("empty");
			} finally {
				void context.close();
			}
		}

		void draw();
		return () => {
			cancelled = true;
		};
	}, [audioUrl]);

	return (
		<div
			className={`relative overflow-hidden rounded-md border border-line bg-paper ${className ?? ""}`}
		>
			<canvas
				ref={canvasRef}
				role="img"
				aria-label="Spectrogram of the call"
				className="absolute inset-0 block h-full w-full"
				style={{
					opacity: state === "ready" ? 1 : 0,
					transition: "opacity 200ms ease",
				}}
			/>
			{children && state === "ready" ? (
				<div className="pointer-events-none absolute inset-0">{children}</div>
			) : null}
			{state !== "ready" ? (
				<div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-muted-foreground text-xs">
					{state === "loading"
						? "Rendering spectrogram…"
						: "Spectrogram unavailable"}
				</div>
			) : null}
		</div>
	);
}

export function QuietSpectrogram({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		if (canvasRef.current) paintNoiseFloor(canvasRef.current);
	}, []);

	return (
		<div
			className={`relative overflow-hidden rounded-md border border-line bg-paper ${className ?? ""}`}
		>
			<canvas
				ref={canvasRef}
				aria-hidden="true"
				className="absolute inset-0 block h-full w-full"
			/>
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-page px-page text-center">
				{children}
			</div>
		</div>
	);
}

function paintNoiseFloor(canvas: HTMLCanvasElement): void {
	canvas.width = NOISE_WIDTH;
	canvas.height = NOISE_HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const image = ctx.createImageData(NOISE_WIDTH, NOISE_HEIGHT);

	let seed = NOISE_SEED;
	const random = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};

	for (let y = 0; y < NOISE_HEIGHT; y += 1) {
		const depth = y / NOISE_HEIGHT;
		for (let x = 0; x < NOISE_WIDTH; x += 1) {
			const speck = random() > 0.985 ? 0.05 : 0;
			const level = depth ** 7 * 0.42 * random() + speck;
			const pixel = (y * NOISE_WIDTH + x) * 4;
			image.data[pixel] = lerp(PAPER[0], MOSS[0], level);
			image.data[pixel + 1] = lerp(PAPER[1], MOSS[1], level);
			image.data[pixel + 2] = lerp(PAPER[2], MOSS[2], level);
			image.data[pixel + 3] = 255;
		}
	}

	ctx.putImageData(image, 0, 0);
}

function paint(canvas: HTMLCanvasElement, buffer: AudioBuffer): void {
	const samples = buffer.getChannelData(0);
	const sampleRate = buffer.sampleRate;
	const frameCount = Math.max(
		1,
		Math.floor((samples.length - FFT_SIZE) / HOP) + 1,
	);
	const nyquistBin = FFT_SIZE / 2;
	const maxBin = Math.min(
		nyquistBin,
		Math.ceil((MAX_HZ / (sampleRate / 2)) * nyquistBin),
	);

	const window = new Float32Array(FFT_SIZE);
	for (let i = 0; i < FFT_SIZE; i += 1) {
		window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1));
	}

	canvas.width = frameCount;
	canvas.height = maxBin;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const image = ctx.createImageData(frameCount, maxBin);

	const real = new Float32Array(FFT_SIZE);
	const imag = new Float32Array(FFT_SIZE);

	for (let frame = 0; frame < frameCount; frame += 1) {
		const offset = frame * HOP;
		for (let i = 0; i < FFT_SIZE; i += 1) {
			real[i] = (samples[offset + i] ?? 0) * window[i];
			imag[i] = 0;
		}
		fftMagnitudes(real, imag);

		for (let bin = 0; bin < maxBin; bin += 1) {
			const mag = Math.hypot(real[bin], imag[bin]) / FFT_SIZE;
			const db = 20 * Math.log10(mag + 1e-9);
			const level = clamp01((db - DB_FLOOR) / (DB_CEIL - DB_FLOOR));
			const y = maxBin - 1 - bin;
			const pixel = (y * frameCount + frame) * 4;
			image.data[pixel] = lerp(PAPER[0], MOSS[0], level);
			image.data[pixel + 1] = lerp(PAPER[1], MOSS[1], level);
			image.data[pixel + 2] = lerp(PAPER[2], MOSS[2], level);
			image.data[pixel + 3] = 255;
		}
	}

	ctx.putImageData(image, 0, 0);
}

function clamp01(value: number): number {
	return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(from: number, to: number, t: number): number {
	return Math.round(from + (to - from) * t);
}

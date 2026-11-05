import {
	AudioWaveform,
	Pause,
	Play,
	RotateCcw,
	SlidersHorizontal,
} from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useRef } from "react";
import { CardHeader } from "~/components/card-header.tsx";
import { Button } from "~/components/ui/button.tsx";
import { Toggle } from "~/components/ui/toggle.tsx";
import { type Rgb, rampColor } from "~/lib/spectrogram.ts";
import { useLiveAudio } from "~/lib/use-live-audio.ts";

const STREAM_URL = "/api/live-stream";

export function LiveAudioCard({ unlocked }: { unlocked: boolean }) {
	if (!unlocked) return null;
	return <PlayerPanel />;
}

function CardShell({
	children,
	status,
}: {
	children: React.ReactNode;
	status?: React.ReactNode;
}) {
	return (
		<section aria-label="Live audio" className="feature-card rounded-md p-4">
			<CardHeader title="Listen" className="gap-3">
				<output className="min-w-0 truncate text-destructive text-xs leading-4">
					{status}
				</output>
			</CardHeader>
			<div className="mt-3 max-[400px]:mt-2">{children}</div>
		</section>
	);
}

function PlayerPanel() {
	const live = useLiveAudio(STREAM_URL);
	const isPlaying = live.state === "playing";
	const isOffline = live.state === "offline";
	const isConnecting = live.state === "connecting";
	const readout = isConnecting
		? live.hasFailed
			? "Retrying…"
			: "Connecting…"
		: isPlaying
			? "Live"
			: isOffline
				? "Offline"
				: "Live feed";

	return (
		<CardShell status={isOffline ? "Stream unavailable" : null}>
			<LiveWaterfall analyser={live.analyser} active={isPlaying} />

			<div className="mt-(--page-gap) flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="icon"
					icon={isPlaying ? Pause : isOffline ? RotateCcw : Play}
					loading={isConnecting}
					onClick={() => (isPlaying ? live.pause() : live.play())}
					aria-label={
						isPlaying
							? "Pause live audio"
							: isOffline
								? "Retry live audio"
								: "Listen live"
					}
				/>
				<span className="text-muted-foreground text-xs">{readout}</span>

				<Popover.Root>
					<Popover.Trigger asChild>
						<Button
							type="button"
							variant="outline"
							size="icon"
							icon={SlidersHorizontal}
							aria-label="Audio settings"
							className="ml-auto"
						/>
					</Popover.Trigger>
					<Popover.Portal>
						<Popover.Content
							align="end"
							sideOffset={6}
							className="z-50 flex w-64 flex-col gap-3 rounded-md border border-[var(--line)] bg-[var(--paper-raised)] p-3 text-[var(--ink)] shadow-md"
						>
							<label className="flex items-center gap-2 text-sm">
								<span className="text-muted-foreground">Gain</span>
								<input
									type="range"
									min={100}
									max={400}
									step={5}
									value={live.gainPercent}
									onChange={(e) => live.setGainPercent(Number(e.target.value))}
									className="min-w-0 flex-1 accent-[var(--moss)]"
									aria-label="Gain"
								/>
								<span className="w-10 text-right tabular-nums">
									{live.gainPercent}%
								</span>
							</label>

							<Toggle
								variant="outline"
								size="sm"
								pressed={live.compression}
								onPressedChange={live.setCompression}
								aria-label="Compression"
								className="self-start"
							>
								<AudioWaveform aria-hidden="true" />
								Compression
							</Toggle>
						</Popover.Content>
					</Popover.Portal>
				</Popover.Root>
			</div>

			{/* biome-ignore lint/a11y/useMediaCaption: a live station feed has no captions track */}
			<audio
				ref={live.audioRef}
				onPlaying={live.onPlaying}
				onPause={live.onPause}
				onError={live.onError}
				onWaiting={live.onWaiting}
				crossOrigin="anonymous"
			/>
		</CardShell>
	);
}

const SPECTROGRAM_HEIGHT = 112;

function LiveWaterfall({
	analyser,
	active,
}: {
	analyser: AnalyserNode | null;
	active: boolean;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !analyser || !active) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const styles = getComputedStyle(canvas);
		const background = readRgb(
			styles.getPropertyValue("--paper"),
			[251, 253, 246],
		);
		const stops: Rgb[] = [
			background,
			readRgb(styles.getPropertyValue("--moss"), [32, 59, 20]),
		];

		const bins = analyser.frequencyBinCount;
		const data = new Uint8Array(bins);
		let raf = 0;

		const draw = () => {
			raf = requestAnimationFrame(draw);
			const w = canvas.width;
			const h = canvas.height;
			ctx.drawImage(canvas, -1, 0);
			analyser.getByteFrequencyData(data);
			for (let y = 0; y < h; y++) {
				const bin = Math.floor(((h - 1 - y) / h) * bins);
				const magnitude = data[bin] / 255;
				const [r, g, b] = rampColor(stops, magnitude);
				ctx.fillStyle = `rgb(${r},${g},${b})`;
				ctx.fillRect(w - 1, y, 1, 1);
			}
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, [analyser, active]);

	return (
		// biome-ignore lint/a11y/noAriaHiddenOnFocusable: the spectrogram is a purely decorative live visualization with no accessible content
		<canvas
			ref={canvasRef}
			width={360}
			height={SPECTROGRAM_HEIGHT}
			className="h-28 w-full rounded-md border border-[var(--line)] bg-[var(--paper)]"
			aria-hidden="true"
		/>
	);
}

function readRgb(value: string, fallback: Rgb): Rgb {
	const hex = value.trim().replace("#", "");
	if (hex.length !== 6) return fallback;
	const n = Number.parseInt(hex, 16);
	if (Number.isNaN(n)) return fallback;
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

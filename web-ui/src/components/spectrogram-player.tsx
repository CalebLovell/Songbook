import { Pause, Play } from "lucide-react";
import {
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	useEffect,
	useReducer,
	useRef,
	useState,
} from "react";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { recordingActionLabel } from "~/components/recording-button.tsx";
import { Spectrogram } from "~/components/spectrogram.tsx";
import { Button } from "~/components/ui/button.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import {
	clipNeedsLoad,
	clipShouldPlay,
	clipShowsPlayhead,
	clipTransition,
	INITIAL_CLIP_STATE,
} from "~/lib/clip-player-machine.ts";
import {
	claimPlayback,
	fetchAudioBlob,
	primeForPlayback,
} from "~/lib/use-playable-audio.ts";

const DEFAULT_HEIGHT = "h-36 max-[400px]:h-28";
const CONTROLS_CLASS =
	"@container/controls mt-(--page-gap) flex flex-wrap items-center gap-2";
const TOTAL_CLASS = "@max-[22rem]/controls:hidden";
const SCRUBBER_CLASS =
	"cursor-pointer touch-none select-none rounded-md focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2";
const TIME_CLASS = "tabular-nums text-muted-foreground text-xs";
const META_DATE_CLASS = "tabular-nums text-muted-foreground text-sm";

const RESYNC_SECONDS = 0.15;

export function SpectrogramPlayer({
	audioUrl,
	speciesName,
	aside,
	fill = false,
	className = DEFAULT_HEIGHT,
}: {
	audioUrl: string;
	speciesName?: string;
	aside?: ReactNode;
	fill?: boolean;
	className?: string;
}) {
	const [state, dispatch] = useReducer(clipTransition, INITIAL_CLIP_STATE);
	const [duration, setDuration] = useState<number | null>(null);
	const audioRef = useRef<HTMLAudioElement>(null);
	const playheadRef = useRef<HTMLDivElement>(null);
	const timeRef = useRef<HTMLSpanElement>(null);
	const sliderRef = useRef<HTMLDivElement>(null);
	const objectUrlRef = useRef<string | null>(null);
	const pendingRef = useRef<number | null>(null);
	const dragRef = useRef<number | null>(null);
	const durationRef = useRef<number | null>(null);
	durationRef.current = duration;

	function paint(fraction: number) {
		const clamped = Math.min(Math.max(fraction, 0), 1);
		const seconds = clamped * (durationRef.current ?? 0);
		if (playheadRef.current)
			playheadRef.current.style.transform = `translateX(${clamped * 100}%)`;
		const clock = formatClock(seconds);
		if (timeRef.current && timeRef.current.textContent !== clock) {
			timeRef.current.textContent = clock;
			sliderRef.current?.setAttribute(
				"aria-valuenow",
				String(Math.round(seconds)),
			);
			sliderRef.current?.setAttribute(
				"aria-valuetext",
				`${clock} of ${formatClock(durationRef.current ?? 0)}`,
			);
		}
	}

	function paintFromAudio() {
		const audio = audioRef.current;
		if (audio && audio.duration > 0) paint(audio.currentTime / audio.duration);
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: status is the trigger
	useEffect(() => {
		if (!clipNeedsLoad(state)) return;
		const audio = audioRef.current;
		if (!audio) return;
		let cancelled = false;
		fetchAudioBlob(audioUrl).then(
			(blob) => {
				if (cancelled) return;
				objectUrlRef.current = URL.createObjectURL(blob);
				audio.addEventListener(
					"loadedmetadata",
					() => {
						if (Number.isFinite(audio.duration)) setDuration(audio.duration);
						if (pendingRef.current !== null) {
							audio.currentTime = pendingRef.current * audio.duration;
							pendingRef.current = null;
						}
						if (!cancelled) dispatch({ type: "loaded" });
					},
					{ once: true },
				);
				audio.src = objectUrlRef.current;
			},
			() => {
				if (!cancelled) dispatch({ type: "loadFailed" });
			},
		);
		return () => {
			cancelled = true;
		};
	}, [state.status, audioUrl]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: status is the trigger
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio || !objectUrlRef.current) return;
		if (clipShouldPlay(state)) {
			if (audio.paused)
				audio.play().catch(() => dispatch({ type: "mediaPaused" }));
		} else if (!audio.paused) {
			audio.pause();
		}
		if (state.status === "ended") paint(0);
		else if (state.status !== "playing") paintFromAudio();
	}, [state.status]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: status is the trigger
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio || state.status !== "playing") return;
		let anchor = { media: audio.currentTime, wall: performance.now() };
		let lastRaw = audio.currentTime;
		let frame = requestAnimationFrame(function tick(now) {
			const raw = audio.currentTime;
			let at = anchor.media + ((now - anchor.wall) / 1000) * audio.playbackRate;
			if (Math.abs(raw - at) > RESYNC_SECONDS) {
				anchor = { media: raw, wall: now };
				at = raw;
			} else if (raw !== lastRaw) {
				anchor.media += (raw - at) * 0.1;
			}
			lastRaw = raw;
			if (audio.duration > 0) paint(at / audio.duration);
			frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	}, [state.status]);

	useEffect(() => {
		const audio = audioRef.current;
		return () => {
			audio?.pause();
			if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
		};
	}, []);

	function seekTo(fraction: number) {
		const clamped = Math.min(Math.max(fraction, 0), 1);
		const audio = audioRef.current;
		if (audio && audio.duration > 0)
			audio.currentTime = clamped * audio.duration;
		else pendingRef.current = clamped;
		paint(clamped);
	}

	function toggle() {
		primeForPlayback(audioRef.current);
		dispatch({ type: "toggle" });
	}

	function fractionAt(event: PointerEvent<HTMLDivElement>): number {
		const box = event.currentTarget.getBoundingClientRect();
		return (event.clientX - box.left) / box.width;
	}

	function onPointerDown(event: PointerEvent<HTMLDivElement>) {
		if (event.button !== 0) return;
		dragRef.current = event.pointerId;
		event.currentTarget.setPointerCapture(event.pointerId);
		dispatch({ type: "scrubStart" });
		seekTo(fractionAt(event));
	}

	function onPointerMove(event: PointerEvent<HTMLDivElement>) {
		if (dragRef.current !== event.pointerId) return;
		if ((event.buttons & 1) === 0) {
			onPointerEnd(event);
			return;
		}
		seekTo(fractionAt(event));
	}

	function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
		if (dragRef.current !== event.pointerId) return;
		dragRef.current = null;
		dispatch({ type: "scrubEnd" });
	}

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		const audio = audioRef.current;
		const length = duration ?? 0;
		const at =
			audio && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
		const step = length > 0 ? 0.5 / length : 0.05;
		const moves: Record<string, number> = {
			ArrowLeft: at - step,
			ArrowDown: at - step,
			ArrowRight: at + step,
			ArrowUp: at + step,
			PageDown: at - step * 5,
			PageUp: at + step * 5,
			Home: 0,
			End: 1,
		};
		if (event.key === " ") {
			event.preventDefault();
			toggle();
		} else if (event.key in moves) {
			event.preventDefault();
			seekTo(moves[event.key]);
		}
	}

	const isPlaying = state.status === "playing";
	const isLoading = state.status === "loading" && state.afterLoad === "play";
	const total = formatClock(duration ?? 0);

	return (
		<div className={fill ? "flex flex-1 flex-col" : undefined}>
			<div
				ref={sliderRef}
				role="slider"
				tabIndex={0}
				aria-label={
					speciesName ? `${speciesName} call position` : "Call position"
				}
				aria-valuemin={0}
				aria-valuemax={Math.round(duration ?? 0)}
				aria-valuenow={0}
				aria-valuetext={`0:00.0 of ${total}`}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerEnd}
				onPointerCancel={onPointerEnd}
				onLostPointerCapture={onPointerEnd}
				onKeyDown={onKeyDown}
				className={
					fill ? `${SCRUBBER_CLASS} flex flex-1 flex-col` : SCRUBBER_CLASS
				}
			>
				<Spectrogram
					audioUrl={audioUrl}
					onDecoded={setDuration}
					className={className}
				>
					<div
						ref={playheadRef}
						aria-hidden="true"
						className={`absolute inset-0 will-change-transform ${clipShowsPlayhead(state) ? "" : "opacity-0"}`}
					>
						<div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-[var(--ink)]" />
					</div>
				</Spectrogram>
			</div>

			<div className={CONTROLS_CLASS}>
				<Button
					type="button"
					size="icon-sm"
					icon={isPlaying ? Pause : Play}
					loading={isLoading}
					onClick={toggle}
					aria-label={recordingActionLabel(isPlaying, speciesName)}
				/>
				<span className={TIME_CLASS}>
					<span ref={timeRef}>0:00.0</span>
					<span className={TOTAL_CLASS}> / {total}</span>
				</span>
				{aside ? (
					<div className="ml-auto flex flex-wrap items-center gap-2">
						{aside}
					</div>
				) : null}
			</div>

			<audio
				ref={audioRef}
				preload="none"
				onPlay={() => claimPlayback(audioRef.current)}
				onPlaying={() => dispatch({ type: "mediaPlaying" })}
				onPause={() => {
					if (!audioRef.current?.ended) dispatch({ type: "mediaPaused" });
				}}
				onEnded={() => dispatch({ type: "mediaEnded" })}
				onSeeking={() => {
					if (state.status !== "playing") paintFromAudio();
				}}
			>
				<track kind="captions" />
			</audio>
		</div>
	);
}

export function SpectrogramPlayerSkeleton({
	aside,
	fill = false,
	className = DEFAULT_HEIGHT,
}: {
	aside?: ReactNode;
	fill?: boolean;
	className?: string;
}) {
	return (
		<div
			aria-hidden="true"
			className={fill ? "flex flex-1 flex-col" : undefined}
		>
			<ShellBar className={`rounded-md ${className}`} />
			<div className={CONTROLS_CLASS}>
				<ShellSized className="rounded-md">
					<Button type="button" size="icon-sm" icon={Play} disabled />
				</ShellSized>
				<ShellText
					className={`@max-[22rem]/controls:w-10 w-24 ${TIME_CLASS}`}
					barClassName="w-full"
				/>
				{aside ? (
					<div className="ml-auto flex flex-wrap items-center gap-2">
						{aside}
					</div>
				) : null}
			</div>
		</div>
	);
}

export function ClipMeta({
	heardAt,
	confidence,
}: {
	heardAt: string;
	confidence: number | null;
}) {
	return (
		<>
			<span className={META_DATE_CLASS}>{heardAt}</span>
			{confidence !== null ? <ConfidencePill confidence={confidence} /> : null}
		</>
	);
}

export function ClipMetaSkeleton() {
	return (
		<>
			<ShellText className={`w-40 ${META_DATE_CLASS}`} barClassName="w-full" />
			<ShellSized className="rounded-full">
				<ConfidencePill confidence={0.9} />
			</ShellSized>
		</>
	);
}

function formatClock(seconds: number): string {
	const tenths = Math.max(0, Math.floor(seconds * 10));
	const whole = Math.floor(tenths / 10);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}.${tenths % 10}`;
}

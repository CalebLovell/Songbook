import { Pause, Play, Repeat } from "lucide-react";
import {
	type KeyboardEvent,
	type PointerEvent,
	type ReactNode,
	type Ref,
	useEffect,
	useReducer,
	useRef,
	useState,
} from "react";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { recordingActionLabel } from "~/components/recording-button.tsx";
import { clamp01, Spectrogram } from "~/components/spectrogram.tsx";
import { Button } from "~/components/ui/button.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import {
	clipAwaitsFirstSound,
	clipNeedsLoad,
	clipShouldPlay,
	clipShowsPlayhead,
	clipTransition,
	INITIAL_CLIP_STATE,
} from "~/lib/clip-player-machine.ts";
import {
	type PlayheadClock,
	startPlayheadClock,
	tickPlayheadClock,
} from "~/lib/playhead-clock.ts";
import {
	claimPlayback,
	fetchAudioBlob,
	primeForPlayback,
} from "~/lib/use-playable-audio.ts";

const DEFAULT_HEIGHT = "h-36 max-[400px]:h-28";
const CONTROLS_CLASS =
	"@container/controls mt-page flex flex-wrap items-center gap-2";
const TOTAL_CLASS = "@max-[22rem]/controls:hidden";
const SCRUBBER_CLASS =
	"cursor-pointer touch-none select-none rounded-md focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2";
const TIME_CLASS = "tabular-nums text-muted-foreground text-xs";
const META_DATE_CLASS =
	"tabular-nums text-muted-foreground text-sm @max-[22rem]/controls:text-xs";

const LOOP_CLASS =
	"aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground";

export function SpectrogramPlayer({
	audioUrl,
	speciesName,
	aside,
	playButtonRef,
	fill = false,
	className = DEFAULT_HEIGHT,
}: {
	audioUrl: string;
	speciesName?: string;
	aside?: ReactNode;
	playButtonRef?: Ref<HTMLButtonElement>;
	fill?: boolean;
	className?: string;
}) {
	const [state, dispatch] = useReducer(clipTransition, INITIAL_CLIP_STATE);
	const [duration, setDuration] = useState<number | null>(null);
	const [looping, setLooping] = useState(false);
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
		const clamped = clamp01(fraction);
		const seconds = clamped * (durationRef.current ?? 0);
		if (playheadRef.current)
			playheadRef.current.style.transform = `translateX(${clamped * 100}%)`;
		const clock = formatClock(seconds);
		if (timeRef.current && timeRef.current.textContent !== clock) {
			timeRef.current.textContent = clock;
		}
		const wholeSecond = String(Math.floor(seconds));
		if (sliderRef.current?.getAttribute("aria-valuenow") !== wholeSecond) {
			sliderRef.current?.setAttribute("aria-valuenow", wholeSecond);
			sliderRef.current?.setAttribute(
				"aria-valuetext",
				`${spokenClock(seconds)} of ${spokenClock(durationRef.current ?? 0)}`,
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
				if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
				objectUrlRef.current = URL.createObjectURL(blob);
				audio.addEventListener(
					"loadedmetadata",
					() => {
						if (Number.isFinite(audio.duration)) setDuration(audio.duration);
						if (pendingRef.current !== null) {
							audio.currentTime = pendingRef.current * audio.duration;
							pendingRef.current = null;
						}
					},
					{ once: true },
				);
				audio.src = objectUrlRef.current;
				// Safari loads nothing under preload="none" until play(), so waiting for metadata would hang.
				dispatch({ type: "loaded" });
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
				audio.play().then(
					() => dispatch({ type: "mediaPlaying" }),
					() => dispatch({ type: "mediaPaused" }),
				);
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
		let clock: PlayheadClock | null = null;
		let frame = requestAnimationFrame(function tick(now) {
			const raw = audio.currentTime;
			clock = clock
				? tickPlayheadClock(clock, raw, now, audio.playbackRate)
				: startPlayheadClock(raw, now);
			if (audio.duration > 0) paint(clock.shown / audio.duration);
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
		const clamped = clamp01(fraction);
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

	const isPlaying = clipShouldPlay(state);
	const isLoading = clipAwaitsFirstSound(state);
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
				aria-valuetext={`${spokenClock(0)} of ${spokenClock(duration ?? 0)}`}
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
						<div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-ink" />
					</div>
				</Spectrogram>
			</div>

			<div className={CONTROLS_CLASS}>
				<Button
					ref={playButtonRef}
					type="button"
					size="icon-sm"
					icon={isPlaying ? Pause : Play}
					loading={isLoading}
					onClick={toggle}
					aria-label={recordingActionLabel(isPlaying, speciesName)}
				/>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					icon={Repeat}
					aria-pressed={looping}
					onClick={() => setLooping((on) => !on)}
					aria-label={speciesName ? `Loop ${speciesName} call` : "Loop call"}
					title={looping ? "Looping" : "Loop"}
					className={LOOP_CLASS}
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

			{/* biome-ignore lint/a11y/useMediaCaption: a bird call has no words to caption */}
			<audio
				ref={audioRef}
				preload="none"
				loop={looping}
				onPlay={() => claimPlayback(audioRef.current)}
				onPlaying={() => dispatch({ type: "mediaPlaying" })}
				onPause={() => {
					if (!audioRef.current?.ended) dispatch({ type: "mediaPaused" });
				}}
				onEnded={() => dispatch({ type: "mediaEnded" })}
				onError={() => dispatch({ type: "loadFailed" })}
				onSeeking={() => {
					if (state.status !== "playing") paintFromAudio();
				}}
			/>
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
				<ShellSized className="rounded-md">
					<Button
						type="button"
						variant="outline"
						size="icon-sm"
						icon={Repeat}
						disabled
					/>
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
			<ShellText
				className={`@max-[22rem]/controls:w-32 w-36 ${META_DATE_CLASS}`}
				barClassName="w-full"
			/>
			<ShellSized className="rounded-full">
				<ConfidencePill confidence={0.9} />
			</ShellSized>
		</>
	);
}

function spokenClock(seconds: number): string {
	const whole = Math.floor(seconds);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function formatClock(seconds: number): string {
	const tenths = Math.max(0, Math.floor(seconds * 10));
	const whole = Math.floor(tenths / 10);
	return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}.${tenths % 10}`;
}

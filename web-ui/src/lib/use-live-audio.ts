import { useCallback, useEffect, useRef, useState } from "react";

export type LiveAudioState =
	| "idle"
	| "connecting"
	| "playing"
	| "paused"
	| "offline";

const MIN_GAIN_PERCENT = 100;
const MAX_GAIN_PERCENT = 400;
const MIN_CONNECTING_MS = 800;

export function useLiveAudio(streamUrl: string) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const ctxRef = useRef<AudioContext | null>(null);
	const gainRef = useRef<GainNode | null>(null);
	const compressorRef = useRef<DynamicsCompressorNode | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);

	const [state, setState] = useState<LiveAudioState>("idle");
	const [gainPercent, setGainPercentState] = useState(MIN_GAIN_PERCENT);
	const [compression, setCompressionState] = useState(false);
	const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
	const [hasFailed, setHasFailed] = useState(false);
	const connectStartedAt = useRef(0);
	const failTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const fail = useCallback(() => {
		clearTimeout(failTimer.current);
		const wait = connectStartedAt.current + MIN_CONNECTING_MS - Date.now();
		const goOffline = () => {
			setState("offline");
			setHasFailed(true);
		};
		if (wait <= 0) {
			goOffline();
			return;
		}
		failTimer.current = setTimeout(goOffline, wait);
	}, []);

	const relink = useCallback((withCompression: boolean) => {
		const gain = gainRef.current;
		const compressor = compressorRef.current;
		const analyserNode = analyserRef.current;
		if (!gain || !compressor || !analyserNode) return;
		gain.disconnect();
		compressor.disconnect();
		if (withCompression) {
			gain.connect(compressor);
			compressor.connect(analyserNode);
		} else {
			gain.connect(analyserNode);
		}
	}, []);

	const ensureGraph = useCallback(() => {
		if (ctxRef.current) return;
		const audio = audioRef.current;
		if (!audio) return;
		const ctx = new AudioContext();
		const source = ctx.createMediaElementSource(audio);
		const gain = ctx.createGain();
		gain.gain.value = gainPercent / 100;
		const compressor = ctx.createDynamicsCompressor();
		const analyserNode = ctx.createAnalyser();
		analyserNode.fftSize = 1024;
		analyserNode.smoothingTimeConstant = 0.6;

		source.connect(gain);
		analyserNode.connect(ctx.destination);

		ctxRef.current = ctx;
		gainRef.current = gain;
		compressorRef.current = compressor;
		analyserRef.current = analyserNode;
		relink(compression);
		setAnalyser(analyserNode);
	}, [compression, gainPercent, relink]);

	const play = useCallback(async () => {
		const audio = audioRef.current;
		if (!audio) return;
		clearTimeout(failTimer.current);
		connectStartedAt.current = Date.now();
		setState("connecting");
		try {
			const session = (navigator as { audioSession?: { type: string } })
				.audioSession;
			if (session) session.type = "playback";
			ensureGraph();
			if (!audio.src) audio.src = streamUrl;
			else if (audio.error) audio.load();
			// Both start inside the tap: iOS Safari refuses a play() after an awaited resume().
			await Promise.all([ctxRef.current?.resume(), audio.play()]);
		} catch {
			fail();
		}
	}, [ensureGraph, fail, streamUrl]);

	const pause = useCallback(() => {
		audioRef.current?.pause();
	}, []);

	const setGainPercent = useCallback((pct: number) => {
		const clamped = Math.min(MAX_GAIN_PERCENT, Math.max(MIN_GAIN_PERCENT, pct));
		setGainPercentState(clamped);
		if (gainRef.current) gainRef.current.gain.value = clamped / 100;
	}, []);

	const setCompression = useCallback(
		(on: boolean) => {
			setCompressionState(on);
			relink(on);
		},
		[relink],
	);

	useEffect(() => {
		const onVisible = () => {
			const ctx = ctxRef.current;
			if (document.visibilityState !== "visible" || !ctx) return;
			if (ctx.state !== "running" && !audioRef.current?.paused)
				ctx.resume().catch(() => {});
		};
		document.addEventListener("visibilitychange", onVisible);
		return () => document.removeEventListener("visibilitychange", onVisible);
	}, []);

	useEffect(() => {
		return () => {
			clearTimeout(failTimer.current);
			ctxRef.current?.close();
			ctxRef.current = null;
			gainRef.current = null;
			compressorRef.current = null;
			analyserRef.current = null;
		};
	}, []);

	return {
		audioRef,
		state,
		hasFailed,
		gainPercent,
		setGainPercent,
		compression,
		setCompression,
		analyser,
		play,
		pause,
		onPlaying: () => {
			setState("playing");
			setHasFailed(false);
		},
		onPause: () =>
			setState((s) => (s === "offline" || s === "connecting" ? s : "paused")),
		onError: fail,
		onWaiting: () => setState((s) => (s === "playing" ? s : "connecting")),
	};
}

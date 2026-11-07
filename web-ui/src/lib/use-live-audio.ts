import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
	CONNECT_TIMEOUT_MS,
	INITIAL_LIVE_AUDIO_STATE,
	liveAudioTransition,
	STALL_TIMEOUT_MS,
} from "~/lib/live-audio-machine.ts";

const MIN_GAIN_PERCENT = 100;
const MAX_GAIN_PERCENT = 400;
const MIN_CONNECTING_MS = 800;

export function useLiveAudio(streamUrl: string) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const ctxRef = useRef<AudioContext | null>(null);
	const gainRef = useRef<GainNode | null>(null);
	const compressorRef = useRef<DynamicsCompressorNode | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);

	const [state, dispatch] = useReducer(
		liveAudioTransition,
		INITIAL_LIVE_AUDIO_STATE,
	);
	const [gainPercent, setGainPercentState] = useState(MIN_GAIN_PERCENT);
	const [compression, setCompressionState] = useState(false);
	const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
	const connectStartedAt = useRef(0);

	useEffect(() => {
		const { status } = state;
		const timer =
			status === "connecting"
				? setTimeout(
						() => dispatch({ type: "connectTimedOut" }),
						CONNECT_TIMEOUT_MS,
					)
				: status === "stalled"
					? setTimeout(
							() => dispatch({ type: "stallTimedOut" }),
							STALL_TIMEOUT_MS,
						)
					: status === "failing"
						? setTimeout(
								() => dispatch({ type: "failureShown" }),
								connectStartedAt.current + MIN_CONNECTING_MS - Date.now(),
							)
						: undefined;
		return () => clearTimeout(timer);
	}, [state]);

	useEffect(() => {
		if (state.status === "offline") audioRef.current?.pause();
	}, [state.status]);

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
		const reconnect = state.status === "offline";
		connectStartedAt.current = Date.now();
		dispatch({ type: "listen" });
		try {
			const session = (navigator as { audioSession?: { type: string } })
				.audioSession;
			if (session) session.type = "playback";
			ensureGraph();
			if (!audio.src) audio.src = streamUrl;
			else if (reconnect || audio.error) audio.load();
			// Both start inside the tap: iOS Safari refuses a play() after an awaited resume().
			await Promise.all([ctxRef.current?.resume(), audio.play()]);
		} catch {
			dispatch({ type: "failed" });
		}
	}, [ensureGraph, state.status, streamUrl]);

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
		gainPercent,
		setGainPercent,
		compression,
		setCompression,
		analyser,
		play,
		pause,
		onPlaying: () => dispatch({ type: "mediaPlaying" }),
		onPause: () => dispatch({ type: "mediaPaused" }),
		onError: () => dispatch({ type: "failed" }),
		onWaiting: () => dispatch({ type: "mediaWaiting" }),
	};
}

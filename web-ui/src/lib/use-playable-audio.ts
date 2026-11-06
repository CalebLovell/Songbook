import { useEffect, useRef, useState } from "react";

import { createClipLoader } from "~/lib/clip-loader.ts";

const CACHE_SIZE = 12;
const clipCache = new Map<string, Promise<Blob>>();

// Fetched rather than <audio src>: native loading doesn't reliably reach the
// dynamic audio route, while fetch() does.
export function fetchAudioBlob(audioUrl: string): Promise<Blob> {
	const cached = clipCache.get(audioUrl);
	if (cached) {
		clipCache.delete(audioUrl);
		clipCache.set(audioUrl, cached);
		return cached;
	}
	const pending = fetch(audioUrl).then((response) => {
		if (!response.ok) throw new Error("Failed to fetch audio");
		return response.blob();
	});
	pending.catch(() => clipCache.delete(audioUrl));
	clipCache.set(audioUrl, pending);
	while (clipCache.size > CACHE_SIZE) {
		const oldest = clipCache.keys().next().value;
		if (oldest === undefined) break;
		clipCache.delete(oldest);
	}
	return pending;
}

export function forgetFetchedClips() {
	clipCache.clear();
}

let playingClip: HTMLAudioElement | null = null;

// iOS Safari only lets an element start sound inside a tap, and a slow clip arrives
// after the tap ends. A play() and pause() during the tap unlock the element for good.
export function primeForPlayback(audio: HTMLAudioElement | null) {
	if (!audio || audio.src) return;
	audio.play().catch(() => {});
	audio.pause();
}

export function claimPlayback(audio: HTMLAudioElement | null) {
	if (playingClip && playingClip !== audio) playingClip.pause();
	playingClip = audio;
}

export function usePlayableAudio(audioUrl: string | null) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [loader] = useState(() =>
		createClipLoader({
			fetchClip: fetchAudioBlob,
			toObjectUrl: (blob) => URL.createObjectURL(blob),
			revokeObjectUrl: (objectUrl) => URL.revokeObjectURL(objectUrl),
			onLoadingChange: setIsLoading,
		}),
	);

	useEffect(() => {
		return () => {
			loader.dispose();
			if (playingClip === audioRef.current) playingClip = null;
		};
	}, [loader]);

	async function togglePlay() {
		const audio = audioRef.current;
		if (!audio || !audioUrl) return;

		if (isPlaying) {
			audio.pause();
			return;
		}
		primeForPlayback(audio);
		if (!(await loader.load(audio, audioUrl))) return;
		audio.play().catch(() => setIsPlaying(false));
	}

	return {
		audioRef,
		isPlaying,
		isLoading,
		togglePlay,
		onPlay: () => {
			claimPlayback(audioRef.current);
			setIsPlaying(true);
		},
		onPause: () => setIsPlaying(false),
		onEnded: () => setIsPlaying(false),
	};
}

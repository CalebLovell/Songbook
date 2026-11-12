import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { APP_VERSION } from "./app-version.ts";
import { reloadForRelease, stationReleaseQuery } from "./release.ts";
import { newerRelease, safeToReload } from "./release-data.ts";

const CHECK_EVERY_MS = 30_000;
const INPUT_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

function somethingPlaying() {
	return Array.from(document.querySelectorAll("audio, video")).some(
		(media) => !(media as HTMLMediaElement).paused,
	);
}

function typingInAField() {
	return (
		document.activeElement?.matches(
			"input, textarea, select, [contenteditable='true']",
		) ?? false
	);
}

export function useFollowRelease() {
	const { data: station } = useQuery(stationReleaseQuery);
	const target = newerRelease(APP_VERSION, station ?? null);

	useEffect(() => {
		if (!target) return;
		let lastInput = Date.now();
		const onInput = () => {
			lastInput = Date.now();
		};
		const check = () => {
			const page = {
				hidden: document.visibilityState === "hidden",
				idleMs: Date.now() - lastInput,
				playing: somethingPlaying(),
				editing: typingInAField(),
			};
			if (safeToReload(page)) reloadForRelease(target);
		};
		for (const event of INPUT_EVENTS)
			window.addEventListener(event, onInput, { passive: true });
		document.addEventListener("visibilitychange", check);
		const timer = setInterval(check, CHECK_EVERY_MS);
		check();
		return () => {
			for (const event of INPUT_EVENTS)
				window.removeEventListener(event, onInput);
			document.removeEventListener("visibilitychange", check);
			clearInterval(timer);
		};
	}, [target]);
}

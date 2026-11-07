export type LiveAudioStatus =
	| "idle"
	| "connecting"
	| "failing"
	| "playing"
	| "stalled"
	| "paused"
	| "offline";

export type LiveAudioState = { status: LiveAudioStatus; hasFailed: boolean };

export type LiveAudioEvent =
	| { type: "listen" }
	| { type: "failed" }
	| { type: "connectTimedOut" }
	| { type: "stallTimedOut" }
	| { type: "failureShown" }
	| { type: "mediaPlaying" }
	| { type: "mediaPaused" }
	| { type: "mediaWaiting" };

export const INITIAL_LIVE_AUDIO_STATE: LiveAudioState = {
	status: "idle",
	hasFailed: false,
};

export const CONNECT_TIMEOUT_MS = 20_000;
export const STALL_TIMEOUT_MS = 15_000;

export function liveAudioTransition(
	state: LiveAudioState,
	event: LiveAudioEvent,
): LiveAudioState {
	const to = (status: LiveAudioStatus): LiveAudioState => ({
		...state,
		status,
	});

	switch (state.status) {
		case "idle":
		case "paused":
		case "offline":
			return event.type === "listen" ? to("connecting") : state;

		case "connecting":
			if (event.type === "mediaPlaying") {
				return { status: "playing", hasFailed: false };
			}
			if (event.type === "failed" || event.type === "connectTimedOut") {
				return to("failing");
			}
			return state;

		// Shown as still connecting, so a quick failure doesn't flash past.
		case "failing":
			if (event.type === "mediaPlaying") {
				return { status: "playing", hasFailed: false };
			}
			if (event.type === "failureShown") {
				return { status: "offline", hasFailed: true };
			}
			return state;

		case "playing":
			if (event.type === "mediaPaused") return to("paused");
			if (event.type === "mediaWaiting") return to("stalled");
			if (event.type === "failed") {
				return { status: "offline", hasFailed: true };
			}
			return state;

		case "stalled":
			if (event.type === "mediaPlaying") return to("playing");
			if (event.type === "mediaPaused") return to("paused");
			if (event.type === "failed" || event.type === "stallTimedOut") {
				return { status: "offline", hasFailed: true };
			}
			return state;
	}
}

export function liveAudioIsConnecting({ status }: LiveAudioState): boolean {
	return status === "connecting" || status === "failing";
}

export function liveAudioIsPlaying({ status }: LiveAudioState): boolean {
	return status === "playing" || status === "stalled";
}

export function liveAudioReadout(state: LiveAudioState): string {
	if (liveAudioIsConnecting(state)) {
		return state.hasFailed ? "Retrying…" : "Connecting…";
	}
	switch (state.status) {
		case "playing":
			return "Live";
		case "stalled":
			return "Buffering…";
		case "offline":
			return "Offline";
		default:
			return "Live feed";
	}
}

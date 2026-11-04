export type ClipStatus =
	| "idle"
	| "loading"
	| "paused"
	| "playing"
	| "scrubbing"
	| "ended"
	| "error";

export type ClipState = {
	status: ClipStatus;
	afterLoad: "play" | "pause" | "scrub";
	resumeAfterScrub: boolean;
};

export type ClipEvent =
	| { type: "toggle" }
	| { type: "loaded" }
	| { type: "loadFailed" }
	| { type: "scrubStart" }
	| { type: "scrubEnd" }
	| { type: "mediaPlaying" }
	| { type: "mediaPaused" }
	| { type: "mediaEnded" };

export const INITIAL_CLIP_STATE: ClipState = {
	status: "idle",
	afterLoad: "pause",
	resumeAfterScrub: false,
};

export function clipTransition(state: ClipState, event: ClipEvent): ClipState {
	const to = (
		status: ClipStatus,
		patch: Partial<ClipState> = {},
	): ClipState => ({
		...state,
		status,
		...patch,
	});

	switch (state.status) {
		case "idle":
		case "error":
			if (event.type === "toggle") return to("loading", { afterLoad: "play" });
			if (event.type === "scrubStart")
				return to("loading", { afterLoad: "scrub" });
			return state;

		case "loading":
			switch (event.type) {
				case "toggle":
					return to("loading", {
						afterLoad: state.afterLoad === "play" ? "pause" : "play",
					});
				case "scrubStart":
					return to("loading", { afterLoad: "scrub" });
				case "scrubEnd":
					return state.afterLoad === "scrub"
						? to("loading", { afterLoad: "pause" })
						: state;
				case "loaded":
					if (state.afterLoad === "play") return to("playing");
					if (state.afterLoad === "scrub")
						return to("scrubbing", { resumeAfterScrub: false });
					return to("paused");
				case "loadFailed":
					return to("error");
				default:
					return state;
			}

		case "playing":
			switch (event.type) {
				case "toggle":
				case "mediaPaused":
					return to("paused");
				case "scrubStart":
					return to("scrubbing", { resumeAfterScrub: true });
				case "mediaEnded":
					return to("ended");
				default:
					return state;
			}

		case "paused":
		case "ended":
			switch (event.type) {
				case "toggle":
				case "mediaPlaying":
					return to("playing");
				case "scrubStart":
					return to("scrubbing", { resumeAfterScrub: false });
				default:
					return state;
			}

		case "scrubbing":
			if (event.type === "scrubEnd")
				return to(state.resumeAfterScrub ? "playing" : "paused");
			return state;
	}
}

export function clipShouldPlay(state: ClipState): boolean {
	return state.status === "playing";
}

export function clipNeedsLoad(state: ClipState): boolean {
	return state.status === "loading";
}

export function clipShowsPlayhead(state: ClipState): boolean {
	return (
		state.status === "playing" ||
		state.status === "paused" ||
		state.status === "scrubbing" ||
		(state.status === "loading" && state.afterLoad === "scrub")
	);
}

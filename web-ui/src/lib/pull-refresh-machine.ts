const RESISTANCE = 0.5;
const MAX_PULL = 96;
const REST = 56;
export const PULL_THRESHOLD = 64;

type Point = { x: number; y: number };

export type PullState =
	| { phase: "idle"; pull: 0 }
	| { phase: "tracking"; pull: 0; start: Point }
	| { phase: "pulling"; pull: number; start: Point }
	| { phase: "refreshing"; pull: number }
	| { phase: "settling"; pull: 0 };

export type PullEvent =
	| { type: "touchStart"; point: Point; fingers: number; atTop: boolean }
	| { type: "touchMove"; point: Point }
	| { type: "touchEnd" }
	| { type: "touchCancel" }
	| { type: "refreshDone" }
	| { type: "settled" };

export const INITIAL_PULL_STATE: PullState = { phase: "idle", pull: 0 };
const IDLE = INITIAL_PULL_STATE;
const SETTLING: PullState = { phase: "settling", pull: 0 };

export function pullTransition(state: PullState, event: PullEvent): PullState {
	switch (state.phase) {
		case "idle":
			if (event.type !== "touchStart") return state;
			return event.fingers === 1 && event.atTop
				? { phase: "tracking", pull: 0, start: event.point }
				: state;

		case "tracking":
			switch (event.type) {
				case "touchStart":
				case "touchEnd":
				case "touchCancel":
					return IDLE;
				case "touchMove": {
					const dx = event.point.x - state.start.x;
					const dy = event.point.y - state.start.y;
					if (dy <= 0 || Math.abs(dx) > dy) return IDLE;
					return {
						phase: "pulling",
						pull: pullDistance(dy),
						start: state.start,
					};
				}
				default:
					return state;
			}

		case "pulling":
			switch (event.type) {
				case "touchMove":
					return {
						...state,
						pull: pullDistance(event.point.y - state.start.y),
					};
				case "touchEnd":
					return state.pull >= PULL_THRESHOLD
						? { phase: "refreshing", pull: REST }
						: SETTLING;
				case "touchStart":
				case "touchCancel":
					return SETTLING;
				default:
					return state;
			}

		case "refreshing":
			return event.type === "refreshDone" ? SETTLING : state;

		case "settling":
			return event.type === "settled" ? IDLE : state;
	}
}

function pullDistance(dy: number) {
	return Math.min(MAX_PULL, Math.max(0, dy * RESISTANCE));
}

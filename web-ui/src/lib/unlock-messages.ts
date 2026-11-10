import type { UnlockResult } from "./auth.server.ts";

type FailureReason = Extract<UnlockResult, { ok: false }>["reason"];

export const UNLOCK_MESSAGES: Record<FailureReason, string> = {
	invalid: "Incorrect password.",
	throttled: "Too many attempts. Try again in a few minutes.",
	"not-set-up": "No password has been set for this station.",
	misconfigured: "Sign-in is unavailable right now.",
};

export const UNREACHABLE_MESSAGE =
	"Can't reach the station. Check your connection.";

export const STATION_ERROR_MESSAGE = "Something went wrong. Try again.";

export function messageForThrown(cause: unknown) {
	return cause instanceof TypeError
		? UNREACHABLE_MESSAGE
		: STATION_ERROR_MESSAGE;
}

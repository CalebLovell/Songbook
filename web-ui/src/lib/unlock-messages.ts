import type { UnlockResult } from "./auth.server.ts";

type FailureReason = Extract<UnlockResult, { ok: false }>["reason"];

export const UNLOCK_MESSAGES: Record<FailureReason, string> = {
	invalid: "That password is not right.",
	throttled: "Too many attempts. Wait a few minutes and try again.",
	"not-set-up":
		"This station has no password yet. Set one on the Pi with scripts/set_web_ui_password.sh.",
	misconfigured:
		"The station can't read its password file, so nobody can sign in. Its log says why.",
};

export const UNREACHABLE_MESSAGE =
	"The station could not be reached. Check that it's on and that you're connected.";

export const STATION_ERROR_MESSAGE =
	"Something went wrong on the station. Try again; if it keeps happening, its log says why.";

export function messageForThrown(cause: unknown) {
	return cause instanceof TypeError
		? UNREACHABLE_MESSAGE
		: STATION_ERROR_MESSAGE;
}

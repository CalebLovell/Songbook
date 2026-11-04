export type UpdateRunState =
	| "idle"
	| "checking"
	| "updating"
	| "failed"
	| "updated";

export type UpdateState = {
	managed: boolean;
	installed: { version: string; installedAt: string } | null;
	latest: { version: string } | null;
	checkedAt: string | null;
	state: UpdateRunState;
	message: string | null;
	target: string | null;
};

export const UNMANAGED_UPDATE_STATE: UpdateState = {
	managed: false,
	installed: null,
	latest: null,
	checkedAt: null,
	state: "idle",
	message: null,
	target: null,
};

const RUN_STATES: readonly UpdateRunState[] = [
	"idle",
	"checking",
	"updating",
	"failed",
	"updated",
];

function parseJson(text: string | null): Record<string, unknown> | null {
	if (!text) return null;
	try {
		const value: unknown = JSON.parse(text);
		return value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

const text = (value: unknown) =>
	typeof value === "string" && value.length > 0 ? value : null;

export function parseUpdateState(
	installedText: string | null,
	statusText: string | null,
): UpdateState {
	const installed = parseJson(installedText);
	const status = parseJson(statusText);
	const latest =
		status?.latest && typeof status.latest === "object"
			? (status.latest as Record<string, unknown>)
			: null;
	const state = RUN_STATES.find((value) => value === status?.state) ?? "idle";
	return {
		managed: true,
		installed:
			installed && text(installed.version)
				? {
						version: text(installed.version) as string,
						installedAt: text(installed.installedAt) ?? "",
					}
				: null,
		latest:
			latest && text(latest.version)
				? {
						version: text(latest.version) as string,
					}
				: null,
		checkedAt: text(status?.checkedAt),
		state,
		message: text(status?.message),
		target: state === "updating" ? text(status?.target) : null,
	};
}

export function updateBusy(state: UpdateState): boolean {
	return state.state === "checking" || state.state === "updating";
}

export function availableUpdate(state: UpdateState): string | null {
	if (!state.latest) return null;
	return state.latest.version === state.installed?.version
		? null
		: state.latest.version;
}

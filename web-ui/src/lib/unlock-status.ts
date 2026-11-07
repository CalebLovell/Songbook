import type { AnyRouter } from "@tanstack/react-router";

import { getUnlockStatusFn } from "~/lib/auth.ts";
import { refreshAllData } from "~/lib/query-client.ts";

export type UnlockStatus = Awaited<ReturnType<typeof getUnlockStatusFn>>;

let router: AnyRouter | null = null;
let known: UnlockStatus | null = null;
let inFlight: Promise<UnlockStatus> | null = null;

export function registerUnlockStatusRouter(next: AnyRouter) {
	router = next;
}

function fetchStatus(): Promise<UnlockStatus> {
	inFlight ??= getUnlockStatusFn()
		.then((status) => {
			known = status;
			return status;
		})
		.finally(() => {
			inFlight = null;
		});
	return inFlight;
}

const sameStatus = (a: UnlockStatus, b: UnlockStatus) =>
	a.unlocked === b.unlocked &&
	a.state === b.state &&
	a.siteName === b.siteName &&
	a.artwork === b.artwork;

export async function unlockStatusForNavigation(): Promise<UnlockStatus> {
	if (typeof window === "undefined") return getUnlockStatusFn();

	if (!known) return fetchStatus();

	const shown = known;
	fetchStatus().then(
		(fresh) => {
			if (!sameStatus(fresh, shown) && router) {
				void refreshAllData(router, router.options.context.queryClient);
			}
		},
		() => {},
	);
	return shown;
}

export function forgetUnlockStatus() {
	known = null;
}

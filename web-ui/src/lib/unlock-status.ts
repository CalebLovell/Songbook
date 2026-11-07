import type { AnyRouter } from "@tanstack/react-router";

import { getUnlockStatusFn } from "~/lib/auth.ts";
import { refreshAllData } from "~/lib/query-client.ts";

export type UnlockStatus = Awaited<ReturnType<typeof getUnlockStatusFn>>;

let router: AnyRouter | null = null;
let known: UnlockStatus | null = null;
let inFlight: Promise<UnlockStatus> | null = null;
let wasForgotten = false;

export function registerUnlockStatusRouter(next: AnyRouter) {
	router = next;
}

function fetchStatus(): Promise<UnlockStatus> {
	if (inFlight) return inFlight;
	const request: Promise<UnlockStatus> = getUnlockStatusFn()
		.then((status) => {
			if (inFlight === request) known = status;
			return status;
		})
		.finally(() => {
			if (inFlight === request) inFlight = null;
		});
	inFlight = request;
	return request;
}

function statusSentWithPage(): UnlockStatus | null {
	if (wasForgotten) return null;
	const root = router?.state.matches.find(
		(match) => match.routeId === "__root__",
	);
	return root?.context?.auth ?? null;
}

const sameStatus = (a: UnlockStatus, b: UnlockStatus) =>
	a.unlocked === b.unlocked &&
	a.state === b.state &&
	a.siteName === b.siteName &&
	a.artwork === b.artwork;

export async function unlockStatusForNavigation(): Promise<UnlockStatus> {
	if (typeof window === "undefined") return getUnlockStatusFn();

	const shown = known ?? statusSentWithPage();
	if (!shown) return fetchStatus();

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
	inFlight = null;
	wasForgotten = true;
}

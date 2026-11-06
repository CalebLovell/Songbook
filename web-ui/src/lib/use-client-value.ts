import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

export function useClientValue<T>(readInBrowser: () => T, onServer: T): T {
	return useSyncExternalStore(noSubscription, readInBrowser, () => onServer);
}

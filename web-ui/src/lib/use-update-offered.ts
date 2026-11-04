import { useEffect, useState } from "react";
import { getUpdateState } from "./updates.ts";
import { availableUpdate } from "./updates-data.ts";

const INTERVAL_MS = 60_000;

let offered: string | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<(version: string | null) => void>();

async function refresh() {
	try {
		const state = await getUpdateState();
		offered = state.managed ? availableUpdate(state) : null;
	} catch {
		return;
	}
	for (const listener of listeners) listener(offered);
}

export function useUpdateOffered(enabled: boolean): string | null {
	const [version, setVersion] = useState<string | null>(null);
	useEffect(() => {
		if (!enabled) return;
		listeners.add(setVersion);
		setVersion(offered);
		if (listeners.size === 1) {
			void refresh();
			timer = setInterval(refresh, INTERVAL_MS);
		}
		return () => {
			listeners.delete(setVersion);
			if (listeners.size === 0) clearInterval(timer);
		};
	}, [enabled]);
	return enabled ? version : null;
}

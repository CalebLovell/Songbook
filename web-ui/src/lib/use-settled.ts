import { useEffect, useState } from "react";
import { useClientValue } from "./use-client-value.ts";

type Outcome = { ok: true; value: unknown } | { ok: false; error: unknown };

const outcomes = new WeakMap<Promise<unknown>, Outcome>();
const tracked = new WeakSet<Promise<unknown>>();

function track(promise: Promise<unknown>) {
	if (tracked.has(promise)) return;
	tracked.add(promise);
	promise.then(
		(value) => outcomes.set(promise, { ok: true, value }),
		(error: unknown) => outcomes.set(promise, { ok: false, error }),
	);
}

// Not Suspense: hydration can start before the data script runs, and a boundary
// suspended mid-hydration never leaves its shell. Waiting in state has no such race.
export function useSettled<T>(
	promise: Promise<T>,
): { value: T; current: boolean } | null {
	track(promise);
	const hydrated = useClientValue(() => true, false);
	const [settled, setSettled] = useState<{
		value: T;
		from: Promise<T>;
	} | null>(null);
	const [, rerender] = useState(0);

	useEffect(() => {
		let cancelled = false;
		promise.then(
			(value) => {
				if (!cancelled) setSettled({ value, from: promise });
			},
			() => {
				if (!cancelled) rerender((count) => count + 1);
			},
		);
		return () => {
			cancelled = true;
		};
	}, [promise]);

	const outcome = outcomes.get(promise);
	if (outcome && !outcome.ok) throw outcome.error;
	if (outcome && hydrated) {
		return { value: outcome.value as T, current: true };
	}
	if (!settled) return null;
	return { value: settled.value, current: settled.from === promise };
}

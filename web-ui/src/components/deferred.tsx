import { type ReactNode, useEffect, useState } from "react";

import { useSettled } from "~/lib/use-settled.ts";

export const SHELL_DELAY_MS = 300;

export function Deferred<T>({
	promise,
	shell,
	className,
	shellAfterMs,
	children,
}: {
	promise: Promise<T>;
	shell: ReactNode;
	className?: string;
	shellAfterMs?: number;
	children: (value: T) => ReactNode;
}) {
	const settled = useSettled(promise);
	const stale = settled !== null && !settled.current;
	const waitedOut = useWaitedOut(promise, stale, shellAfterMs);
	if (!settled || waitedOut) {
		return <div className={className}>{shell}</div>;
	}
	return children(settled.value);
}

function useWaitedOut(
	promise: Promise<unknown>,
	stale: boolean,
	ms: number | undefined,
): boolean {
	const [expired, setExpired] = useState<Promise<unknown> | null>(null);
	useEffect(() => {
		if (!stale || ms === undefined) return;
		const timeout = setTimeout(() => setExpired(promise), ms);
		return () => clearTimeout(timeout);
	}, [promise, stale, ms]);
	return stale && expired === promise;
}

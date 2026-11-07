import { type ReactNode, useEffect, useState } from "react";

export const SHELL_DELAY_MS = 300;

export function Deferred<T>({
	query,
	shell,
	className,
	shellAfterMs,
	children,
}: {
	query: { data: T | undefined; isPlaceholderData: boolean };
	shell: ReactNode;
	className?: string;
	shellAfterMs?: number;
	children: (value: T) => ReactNode;
}) {
	const waitedOut = useWaitedOut(query.isPlaceholderData, shellAfterMs);
	if (query.data === undefined || waitedOut) {
		return <div className={className}>{shell}</div>;
	}
	return children(query.data);
}

function useWaitedOut(stale: boolean, ms: number | undefined): boolean {
	const [expired, setExpired] = useState(false);
	useEffect(() => {
		if (!stale || ms === undefined) return;
		const timeout = setTimeout(() => setExpired(true), ms);
		return () => {
			clearTimeout(timeout);
			setExpired(false);
		};
	}, [stale, ms]);
	return stale && expired;
}

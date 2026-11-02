import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Re-runs `fetcher` on an interval and keeps the latest result in state.
 * Client-only by nature (useEffect never runs during SSR) -- the caller
 * supplies the loader's initial data so the first paint isn't empty.
 *
 * That initial data may also be a deferred loader promise, so the page can
 * render before it lands: `data` is then null until the promise settles (show
 * a shell meanwhile), and the polls take over from there.
 *
 * There's no server-push mechanism here (no WebSocket/SSE) -- this is a
 * deliberately simple poll. The underlying query is small, indexed, and
 * LIMIT-bounded, so even a Pi-class server handles a request every few
 * seconds from a handful of viewers without breaking a sweat.
 */
export function usePolledData<T>(
	fetcher: () => Promise<T>,
	initialData: T,
	intervalMs: number,
): { data: T; lastUpdated: Date; replace: (next: T) => void };
export function usePolledData<T>(
	fetcher: () => Promise<T>,
	initialData: Promise<T>,
	intervalMs: number,
): { data: T | null; lastUpdated: Date; replace: (next: T) => void };
export function usePolledData<T>(
	fetcher: () => Promise<T>,
	initialData: T | Promise<T>,
	intervalMs: number,
) {
	const [data, setData] = useState<T | null>(() =>
		initialData instanceof Promise ? null : initialData,
	);
	const [lastUpdated, setLastUpdated] = useState(() => new Date());
	const fetcherRef = useRef(fetcher);
	fetcherRef.current = fetcher;

	// A deferred first answer fills in when it lands -- unless a poll already
	// brought something newer.
	useEffect(() => {
		if (!(initialData instanceof Promise)) return;
		let cancelled = false;
		initialData.then(
			(value) => {
				if (!cancelled) setData((current) => current ?? value);
			},
			// The polls will try again; a shell is better than a crash here.
			() => {},
		);
		return () => {
			cancelled = true;
		};
	}, [initialData]);

	// Bumped by every answer that lands (and by `replace`), so a poll that was
	// already in flight when something newer arrived is dropped, never shown
	// over it.
	const generationRef = useRef(0);

	// One request at a time: the next poll is scheduled only once this one has
	// answered, so a slow Pi never has requests stacking up or answering out of
	// order. A hidden tab doesn't poll at all -- the station is public, and a
	// forgotten tab shouldn't keep asking -- and catches up as soon as it's
	// shown again.
	useEffect(() => {
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		let inFlight = false;

		const schedule = () => {
			clearTimeout(timer);
			if (!cancelled && !document.hidden) timer = setTimeout(poll, intervalMs);
		};

		async function poll() {
			if (cancelled || inFlight || document.hidden) return;
			inFlight = true;
			const generation = generationRef.current;
			try {
				const next = await fetcherRef.current();
				if (!cancelled && generation === generationRef.current) {
					generationRef.current += 1;
					setData(next);
					setLastUpdated(new Date());
				}
			} catch {
				// A transient failure shouldn't kill polling -- just try again
				// on the next tick.
			} finally {
				inFlight = false;
				schedule();
			}
		}

		const onVisibilityChange = () => {
			if (document.hidden) clearTimeout(timer);
			else void poll();
		};

		schedule();
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			cancelled = true;
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [intervalMs]);

	// For an answer that arrives some other way -- a mutation that returns the
	// fresh value -- so the page shows it now rather than at the next tick.
	const replace = useCallback((next: T) => {
		generationRef.current += 1;
		setData(next);
		setLastUpdated(new Date());
	}, []);

	return { data, lastUpdated, replace };
}

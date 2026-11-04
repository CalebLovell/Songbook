import { useCallback, useEffect, useRef, useState } from "react";

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

	useEffect(() => {
		if (!(initialData instanceof Promise)) return;
		let cancelled = false;
		initialData.then(
			(value) => {
				if (!cancelled) setData((current) => current ?? value);
			},
			() => {},
		);
		return () => {
			cancelled = true;
		};
	}, [initialData]);

	const generationRef = useRef(0);

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

	const replace = useCallback((next: T) => {
		generationRef.current += 1;
		setData(next);
		setLastUpdated(new Date());
	}, []);

	return { data, lastUpdated, replace };
}

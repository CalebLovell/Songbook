export function shareRead<T>(
	read: () => Promise<T>,
	ttlMs: number,
	now: () => number = Date.now,
): () => Promise<T> {
	let inFlight: Promise<T> | null = null;
	let latest: { value: T; readAt: number } | null = null;
	return () => {
		if (latest && now() - latest.readAt < ttlMs) {
			return Promise.resolve(latest.value);
		}
		inFlight ??= read()
			.then((value) => {
				latest = { value, readAt: now() };
				return value;
			})
			.finally(() => {
				inFlight = null;
			});
		return inFlight;
	};
}

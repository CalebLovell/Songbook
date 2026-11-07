type SharedReadOptions = {
	maxAgeMs: number;
	version?: () => number;
	now?: () => number;
};

export function shareRead<T>(
	read: () => Promise<T>,
	{ maxAgeMs, version = () => 0, now = Date.now }: SharedReadOptions,
): () => Promise<T> {
	let latest: { value: Promise<T>; version: number; readAt: number } | null =
		null;
	return () => {
		const currentVersion = version();
		if (
			latest &&
			latest.version === currentVersion &&
			now() - latest.readAt < maxAgeMs
		) {
			return latest.value;
		}
		const started = {
			value: read(),
			version: currentVersion,
			readAt: now(),
		};
		latest = started;
		started.value.catch(() => {
			if (latest === started) latest = null;
		});
		return started.value;
	};
}

import { useEffect, useState } from "react";

export function useAgeOffset(dataKey: string, intervalMs = 1_000): number {
	const [offsetMs, setOffsetMs] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-baseline trigger
	useEffect(() => {
		const arrivedAt = Date.now();
		setOffsetMs(0);
		const id = setInterval(
			() => setOffsetMs(Date.now() - arrivedAt),
			intervalMs,
		);
		return () => clearInterval(id);
	}, [dataKey, intervalMs]);

	return offsetMs;
}

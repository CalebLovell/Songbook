import { useEffect, useState } from "react";

export function useAgeOffset(dataKey: string, intervalMs = 1_000): number {
	const [age, setAge] = useState({ dataKey, offsetMs: 0 });

	useEffect(() => {
		const arrivedAt = Date.now();
		const id = setInterval(
			() => setAge({ dataKey, offsetMs: Date.now() - arrivedAt }),
			intervalMs,
		);
		return () => clearInterval(id);
	}, [dataKey, intervalMs]);

	return age.dataKey === dataKey ? age.offsetMs : 0;
}

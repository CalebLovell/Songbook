export function plural(count: number, one: string, many = `${one}s`): string {
	return count === 1 ? one : many;
}

export function compactCount(count: number): string {
	if (count < 1_000) return count.toString();
	const units = [
		{ size: 1_000_000_000, suffix: "b" },
		{ size: 1_000_000, suffix: "m" },
		{ size: 1_000, suffix: "k" },
	];
	for (const { size, suffix } of units) {
		if (count < size) continue;
		const value = count / size;
		const shown = value < 10 ? Math.floor(value * 10) / 10 : Math.floor(value);
		return `${shown}${suffix}`;
	}
	return count.toString();
}

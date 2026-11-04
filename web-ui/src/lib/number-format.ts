export function ordinal(value: number): string {
	const lastTwo = value % 100;
	if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;

	const suffix = ["th", "st", "nd", "rd"][value % 10] ?? "th";
	return `${value}${suffix}`;
}

export function plural(count: number, noun: string): string {
	return `${count.toLocaleString()} ${noun}${count === 1 ? "" : "s"}`;
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

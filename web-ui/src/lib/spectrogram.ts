export type Rgb = [number, number, number];

export function rampColor(stops: Rgb[], t: number): Rgb {
	const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
	const segments = stops.length - 1;
	const scaled = clamped * segments;
	const index = Math.min(Math.floor(scaled), segments - 1);
	const frac = scaled - index;
	const from = stops[index];
	const to = stops[index + 1];
	return [
		Math.round(from[0] + (to[0] - from[0]) * frac),
		Math.round(from[1] + (to[1] - from[1]) * frac),
		Math.round(from[2] + (to[2] - from[2]) * frac),
	];
}

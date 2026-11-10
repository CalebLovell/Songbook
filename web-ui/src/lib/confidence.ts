import type { CSSProperties } from "react";

export function formatConfidence(confidence: number | null): string {
	return confidence != null ? `${Math.round(confidence * 100)}%` : "—";
}

export const CONFIDENT_MIN = 0.9;

const RAMP_FLOOR = 0.7;
const FLOOR_HUE = 48;
const TOP_HUE = 140;

export function confidenceHue(confidence: number): number {
	const share = Math.min(
		1,
		Math.max(0, (confidence - RAMP_FLOOR) / (1 - RAMP_FLOOR)),
	);
	return FLOOR_HUE + (TOP_HUE - FLOOR_HUE) * share;
}

export function confidenceStyle(confidence: number): CSSProperties {
	const hue = confidenceHue(confidence).toFixed(1);
	return {
		backgroundColor: `light-dark(oklch(0.95 0.025 ${hue}), oklch(0.31 0.025 ${hue}))`,
		color: `light-dark(oklch(0.47 0.06 ${hue}), oklch(0.84 0.045 ${hue}))`,
	};
}

export function confidenceTooltip(
	confidence: number,
	{ average = false }: { average?: boolean } = {},
): string {
	const score = formatConfidence(confidence);
	return average
		? `BirdNET averaged ${score} sure across these detections.`
		: `BirdNET was ${score} sure.`;
}

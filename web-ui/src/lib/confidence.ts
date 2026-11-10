import type { CSSProperties } from "react";

export function formatConfidence(confidence: number | null): string {
	return confidence != null ? `${Math.round(confidence * 100)}%` : "—";
}

export const CONFIDENT_MIN = 0.9;

const UNSURE_BELOW = 0.8;
const CONFIDENT_HUE = 150;
const MIDDLING_HUE = 80;
const UNSURE_HUE = 35;

export function confidenceHue(confidence: number): number {
	const shown = Math.round(confidence * 100) / 100;
	if (shown >= CONFIDENT_MIN) return CONFIDENT_HUE;
	if (shown >= UNSURE_BELOW) return MIDDLING_HUE;
	return UNSURE_HUE;
}

export function confidenceStyle(confidence: number): CSSProperties {
	const hue = confidenceHue(confidence);
	return {
		backgroundColor: `light-dark(oklch(0.94 0.035 ${hue}), oklch(0.31 0.045 ${hue}))`,
		color: `light-dark(oklch(0.45 0.09 ${hue}), oklch(0.85 0.065 ${hue}))`,
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

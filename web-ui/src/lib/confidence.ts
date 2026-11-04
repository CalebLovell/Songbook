import type { CSSProperties } from "react";

export function formatConfidence(confidence: number | null): string {
	return confidence != null ? `${Math.round(confidence * 100)}%` : "—";
}

export const CONFIDENT_MIN = 0.9;

const PROBABLE_MIN = 0.75;

export function confidenceStyle(confidence: number): CSSProperties {
	if (confidence >= CONFIDENT_MIN) {
		return {
			backgroundColor: "var(--confidence-high)",
			color: "var(--moss)",
		};
	}

	if (confidence >= PROBABLE_MIN) {
		return {
			backgroundColor: "var(--confidence-mid)",
			color: "var(--bark)",
		};
	}

	return {
		backgroundColor: "var(--confidence-low)",
		color: "var(--ink)",
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

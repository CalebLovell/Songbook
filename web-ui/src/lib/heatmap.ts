import type { Theme } from "~/lib/theme.ts";

const RAMP_FLOOR = 12;

// Between these mixes neither digit colour reaches 4.5:1, so the ramp steps over them.
const DIGIT_GAP: Record<
	Theme,
	{ foregroundDigitLast: number; paperDigitFirst: number }
> = {
	light: { foregroundDigitLast: 59, paperDigitFirst: 66 },
	dark: { foregroundDigitLast: 55, paperDigitFirst: 72 },
};

function rampMoss(share: number, theme: Theme): number {
	const { foregroundDigitLast, paperDigitFirst } = DIGIT_GAP[theme];
	const moss = RAMP_FLOOR + (100 - RAMP_FLOOR) * Math.max(0, share);
	return moss > foregroundDigitLast && moss < paperDigitFirst
		? paperDigitFirst
		: moss;
}

function heatShare(count: number, maximum: number): number {
	if (count <= 0 || maximum <= 0) return 0;
	if (maximum <= 1) return 1;
	return Math.min(1, Math.log(count) / Math.log(maximum));
}

export function heatColorAt(share: number, theme: Theme = "light"): string {
	if (share >= 1) return "var(--moss)";
	return `color-mix(in oklab, var(--moss) ${rampMoss(share, theme).toFixed(1)}%, var(--paper-raised))`;
}

export function heatColor(
	count: number,
	maximum: number,
	theme: Theme = "light",
): string {
	if (count <= 0 || maximum <= 0) return "var(--paper)";
	return heatColorAt(heatShare(count, maximum), theme);
}

export function heatInk(
	count: number,
	maximum: number,
	theme: Theme = "light",
): string {
	if (count <= 0) return "var(--muted-foreground)";
	return rampMoss(heatShare(count, maximum), theme) >=
		DIGIT_GAP[theme].paperDigitFirst
		? "var(--paper)"
		: "var(--foreground)";
}

export function heatMaximum(rows: { hourCounts: number[] }[]): number {
	return rows.reduce((top, row) => Math.max(top, ...row.hourCounts), 0);
}

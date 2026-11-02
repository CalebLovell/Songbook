import type { CSSProperties } from "react";

/**
 * The narrowest `widest` the detections and species control tables size their
 * row numbers to: three digits, the width a first page of 100 detections
 * needs. Both tables' number columns then match, and neither widens as it
 * pages past 99.
 */
export const TABLE_INDEX_FLOOR = 100;

/**
 * A row's number in a list that counts on across pages -- the detections table
 * and the species visit log. A dot that stretches to a capsule for longer
 * numbers, every one on the page as wide as `widest` (the largest number the
 * page shows), so the column of dots and whatever sits beside them line up.
 *
 * The number is always shown whole, on the smallest phones too: a long index
 * takes its width from the text beside it rather than being cut short.
 */
export function IndexDot({ index, widest }: { index: number; widest: number }) {
	const digits = widest.toLocaleString().length;
	return (
		<span
			aria-hidden
			style={{ "--digits": digits } as CSSProperties}
			className="tabular-data inline-flex h-6 w-[max(1.5rem,calc(var(--digits)*1ch+0.75rem))] shrink-0 items-center justify-center rounded-full bg-muted px-1.5 font-bold text-foreground text-xs"
		>
			{index.toLocaleString()}
		</span>
	);
}

import type { CSSProperties } from "react";

export const TABLE_INDEX_FLOOR = 100;

export function IndexDot({ index, widest }: { index: number; widest: number }) {
	const digits = widest.toLocaleString().length;
	return (
		<span
			aria-hidden
			style={{ "--digits": digits } as CSSProperties}
			className="inline-flex h-6 w-[max(1.5rem,calc(var(--digits)*1ch+0.75rem))] shrink-0 items-center justify-center rounded-full bg-muted px-1.5 font-bold text-foreground text-xs tabular-nums"
		>
			{index.toLocaleString()}
		</span>
	);
}

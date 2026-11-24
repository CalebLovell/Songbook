import { type RefObject, useEffect, useState } from "react";

const FULLY_VISIBLE = 0.95;

export function useRowsBelow(
	scrollerRef: RefObject<HTMLElement | null>,
	lastRowKey: string | undefined,
) {
	const [rowsBelow, setRowsBelow] = useState(false);

	useEffect(() => {
		const scroller = scrollerRef.current;
		const lastRow = scroller?.lastElementChild;
		if (!lastRowKey || !scroller || !lastRow) {
			setRowsBelow(false);
			return;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				const latest = entries[entries.length - 1];
				setRowsBelow(latest.intersectionRatio < FULLY_VISIBLE);
			},
			{ root: scroller, threshold: FULLY_VISIBLE },
		);
		observer.observe(lastRow);
		return () => observer.disconnect();
	}, [scrollerRef, lastRowKey]);

	return rowsBelow;
}

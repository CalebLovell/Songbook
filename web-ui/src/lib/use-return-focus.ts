import { useEffect, useRef, useState } from "react";

import { MAIN_CONTENT_ID } from "~/lib/main-content.ts";

export function returnFocusTo(opener: Element | null) {
	const usable =
		opener instanceof HTMLElement &&
		opener !== document.body &&
		opener.isConnected &&
		!opener.matches(":disabled");
	const target = usable ? opener : document.getElementById(MAIN_CONTENT_ID);
	target?.focus({ preventScroll: true });
}

export function useReturnFocus() {
	const [opener] = useState(() =>
		typeof document === "undefined" ? null : document.activeElement,
	);
	const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (pending.current) clearTimeout(pending.current);
		return () => {
			pending.current = setTimeout(() => returnFocusTo(opener));
		};
	}, [opener]);
}

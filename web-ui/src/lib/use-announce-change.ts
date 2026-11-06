import { useEffect, useRef } from "react";

import { announce } from "~/lib/announce.ts";

export function useAnnounceChange(message: string | null) {
	const previous = useRef(message);
	useEffect(() => {
		if (message === previous.current) return;
		previous.current = message;
		if (message) announce(message);
	}, [message]);
}

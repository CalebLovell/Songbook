import { useEffect, useState } from "react";

import { onAnnounce } from "~/lib/announce.ts";

const REPEAT_GAP_MS = 50;

export function LiveAnnouncer() {
	const [message, setMessage] = useState("");

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const stop = onAnnounce((next) => {
			clearTimeout(timer);
			setMessage("");
			timer = setTimeout(() => setMessage(next), REPEAT_GAP_MS);
		});
		return () => {
			clearTimeout(timer);
			stop();
		};
	}, []);

	return (
		<div
			id="live-announcer"
			role="status"
			aria-live="polite"
			aria-atomic="true"
			className="sr-only"
		>
			{message}
		</div>
	);
}

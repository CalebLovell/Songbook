import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export function useSettledFlag(targetId: string) {
	const router = useRouter();
	useEffect(() => {
		const target = document.getElementById(targetId);
		if (!target) return;
		let frame = 0;
		const unsettle = () => {
			cancelAnimationFrame(frame);
			delete target.dataset.settled;
		};
		const settle = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				frame = requestAnimationFrame(() => {
					target.dataset.settled = "";
				});
			});
		};
		settle();
		const stops = [
			router.subscribe("onBeforeNavigate", unsettle),
			router.subscribe("onResolved", settle),
			router.subscribe("onRendered", settle),
		];
		return () => {
			unsettle();
			for (const stop of stops) stop();
		};
	}, [router, targetId]);
}

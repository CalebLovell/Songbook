import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
	INITIAL_PULL_STATE,
	PULL_THRESHOLD,
	type PullEvent,
	pullTransition,
} from "~/lib/pull-refresh-machine.ts";
import { reloadAllData } from "~/lib/query-client.ts";
import { newerStationRelease } from "~/lib/release.ts";
import { cn } from "~/lib/utils.ts";

const MIN_SPIN_MS = 600;
const SETTLE_MS = 180;
const SIZE = 36;

export function PullToRefresh({ children }: { children: ReactNode }) {
	const router = useRouter();
	const queryClient = useQueryClient();
	const wrapperRef = useRef<HTMLDivElement>(null);
	const [state, setState] = useState(INITIAL_PULL_STATE);
	const stateRef = useRef(state);
	const { phase, pull } = state;

	// A ref as well as state: touchmove must decide on preventDefault before React renders.
	function send(event: PullEvent) {
		const next = pullTransition(stateRef.current, event);
		stateRef.current = next;
		setState(next);
		return next;
	}
	const sendRef = useRef(send);
	sendRef.current = send;

	useEffect(() => {
		const wrapper = wrapperRef.current;
		const scroller = document.getElementById("app-scroll");
		if (!wrapper || !scroller) return;
		if (!window.matchMedia("(pointer: coarse)").matches) return;

		function onTouchStart(event: TouchEvent) {
			const touch = event.touches[0];
			sendRef.current({
				type: "touchStart",
				point: { x: touch.clientX, y: touch.clientY },
				fingers: event.touches.length,
				atTop: !scrolledAbove(event.target, scroller as HTMLElement),
			});
		}

		function onTouchMove(event: TouchEvent) {
			const touch = event.touches[0];
			const next = sendRef.current({
				type: "touchMove",
				point: { x: touch.clientX, y: touch.clientY },
			});
			if (next.phase === "pulling" && event.cancelable) event.preventDefault();
		}

		const onTouchEnd = () => sendRef.current({ type: "touchEnd" });
		const onTouchCancel = () => sendRef.current({ type: "touchCancel" });

		wrapper.addEventListener("touchstart", onTouchStart, { passive: true });
		wrapper.addEventListener("touchmove", onTouchMove, { passive: false });
		wrapper.addEventListener("touchend", onTouchEnd);
		wrapper.addEventListener("touchcancel", onTouchCancel);
		return () => {
			wrapper.removeEventListener("touchstart", onTouchStart);
			wrapper.removeEventListener("touchmove", onTouchMove);
			wrapper.removeEventListener("touchend", onTouchEnd);
			wrapper.removeEventListener("touchcancel", onTouchCancel);
		};
	}, []);

	useEffect(() => {
		if (phase !== "refreshing") return;
		let cancelled = false;
		const spun = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS));
		Promise.allSettled([reloadAllData(router, queryClient), spun]).then(() => {
			if (newerStationRelease(queryClient)) window.location.reload();
			else if (!cancelled) sendRef.current({ type: "refreshDone" });
		});
		return () => {
			cancelled = true;
		};
	}, [phase, router, queryClient]);

	useEffect(() => {
		if (phase !== "settling") return;
		const timer = setTimeout(
			() => sendRef.current({ type: "settled" }),
			SETTLE_MS,
		);
		return () => clearTimeout(timer);
	}, [phase]);

	const armed = phase === "refreshing" || pull >= PULL_THRESHOLD;

	return (
		<div
			ref={wrapperRef}
			className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
		>
			{phase !== "idle" && phase !== "tracking" && (
				<output
					aria-hidden={phase !== "refreshing"}
					className={cn(
						"pointer-events-none absolute left-1/2 z-10 flex items-center justify-center rounded-full border shadow-sm",
						phase !== "pulling" &&
							"transition-[transform,opacity,background-color] duration-180 ease-out",
						armed
							? "border-transparent bg-primary text-primary-foreground"
							: "border-line bg-paper-raised text-moss",
					)}
					style={{
						width: SIZE,
						height: SIZE,
						top: -SIZE,
						transform: `translate(-50%, ${pull}px)`,
						opacity: Math.min(1, pull / (PULL_THRESHOLD * 0.6)),
					}}
				>
					<RefreshCw
						className={cn("size-4", phase === "refreshing" && "animate-spin")}
						style={
							phase === "refreshing"
								? undefined
								: { transform: `rotate(${(pull / PULL_THRESHOLD) * 270}deg)` }
						}
					/>
					{phase === "refreshing" && (
						<span className="sr-only">Refreshing</span>
					)}
				</output>
			)}
			{children}
		</div>
	);
}

function scrolledAbove(target: EventTarget | null, scroller: HTMLElement) {
	let node = target instanceof Element ? target : null;
	while (node) {
		if (node.scrollTop > 0) return true;
		if (node === scroller) return false;
		node = node.parentElement;
	}
	return false;
}

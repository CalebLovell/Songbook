import { type AnyRouter, useRouter } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils.ts";

/** How far the finger travels per pixel the indicator moves. */
const RESISTANCE = 0.5;
/** Indicator travel past which letting go refreshes. */
const THRESHOLD = 64;
/** Indicator travel it can't be pulled beyond. */
const MAX_PULL = 96;
/** Where the indicator rests while the page refreshes. */
const REST = 56;
/** Shortest spin, so a quick answer still reads as a refresh. */
const MIN_SPIN_MS = 600;
const SIZE = 36;

type Phase = "idle" | "pulling" | "refreshing" | "settling";

/**
 * Pull down from the top of the page to reload it, on touch screens only.
 *
 * Wraps the shell's scrolling `main` (#app-scroll) -- the window never scrolls,
 * so the browser's own pull-to-refresh never fires. A pull re-runs every
 * loader on the page through `router.invalidate()`, then waits for the
 * deferred promises those loaders hand back, so the spinner stops when the
 * fresh data has landed rather than when the loaders merely returned. Parts
 * rendered through Deferred keep their content up meanwhile.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
	const router = useRouter();
	const wrapperRef = useRef<HTMLDivElement>(null);
	const [pull, setPull] = useState(0);
	const [phase, setPhase] = useState<Phase>("idle");
	const phaseRef = useRef<Phase>("idle");
	phaseRef.current = phase;

	useEffect(() => {
		const wrapper = wrapperRef.current;
		const scroller = document.getElementById("app-scroll");
		if (!wrapper || !scroller) return;
		if (!window.matchMedia("(pointer: coarse)").matches) return;

		let start: { x: number; y: number } | null = null;
		let engaged = false;
		let distance = 0;

		function onTouchStart(event: TouchEvent) {
			start = null;
			engaged = false;
			if (phaseRef.current !== "idle" || event.touches.length !== 1) return;
			if (scrolledAbove(event.target, scroller as HTMLElement)) return;
			const touch = event.touches[0];
			start = { x: touch.clientX, y: touch.clientY };
		}

		function onTouchMove(event: TouchEvent) {
			if (!start) return;
			const touch = event.touches[0];
			const dx = touch.clientX - start.x;
			const dy = touch.clientY - start.y;
			if (!engaged) {
				// Decided on the first move: a sideways or upward swipe is left to
				// the page. Waiting any longer would let the browser start a scroll,
				// after which the move can no longer be held back.
				if (dy <= 0 || Math.abs(dx) > dy) {
					start = null;
					return;
				}
				engaged = true;
				setPhase("pulling");
			}
			if (event.cancelable) event.preventDefault();
			distance = Math.min(MAX_PULL, Math.max(0, dy * RESISTANCE));
			setPull(distance);
		}

		function onTouchEnd() {
			if (!engaged) return;
			start = null;
			engaged = false;
			if (distance >= THRESHOLD) {
				setPhase("refreshing");
				setPull(REST);
				const spun = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS));
				Promise.allSettled([refreshPage(router), spun]).then(() => settle());
			} else {
				settle();
			}
			distance = 0;
		}

		function settle() {
			setPhase("settling");
			setPull(0);
			setTimeout(() => setPhase("idle"), 180);
		}

		wrapper.addEventListener("touchstart", onTouchStart, { passive: true });
		// Not passive: an engaged pull holds the page still under the finger.
		wrapper.addEventListener("touchmove", onTouchMove, { passive: false });
		wrapper.addEventListener("touchend", onTouchEnd);
		wrapper.addEventListener("touchcancel", onTouchEnd);
		return () => {
			wrapper.removeEventListener("touchstart", onTouchStart);
			wrapper.removeEventListener("touchmove", onTouchMove);
			wrapper.removeEventListener("touchend", onTouchEnd);
			wrapper.removeEventListener("touchcancel", onTouchEnd);
		};
	}, [router]);

	const armed = phase === "refreshing" || pull >= THRESHOLD;

	return (
		<div
			ref={wrapperRef}
			className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
		>
			{phase !== "idle" && (
				<output
					aria-hidden={phase !== "refreshing"}
					className={cn(
						"pointer-events-none absolute left-1/2 z-10 flex items-center justify-center rounded-full border shadow-sm",
						phase !== "pulling" &&
							"transition-[transform,opacity,background-color] duration-180 ease-out",
						armed
							? "border-transparent bg-(--moss) text-white"
							: "border-(--line) bg-(--paper-raised) text-(--moss)",
					)}
					style={{
						width: SIZE,
						height: SIZE,
						top: -SIZE,
						transform: `translate(-50%, ${pull}px)`,
						opacity: Math.min(1, pull / (THRESHOLD * 0.6)),
					}}
				>
					<RefreshCw
						className={cn("size-4", phase === "refreshing" && "animate-spin")}
						style={
							phase === "refreshing"
								? undefined
								: { transform: `rotate(${(pull / THRESHOLD) * 270}deg)` }
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

/**
 * Whether anything between the touch and the page's scroller -- the scroller
 * included -- is scrolled down, in which case a downward drag is a scroll
 * back up rather than a pull.
 */
function scrolledAbove(target: EventTarget | null, scroller: HTMLElement) {
	let node = target instanceof Element ? target : null;
	while (node) {
		if (node.scrollTop > 0) return true;
		if (node === scroller) return false;
		node = node.parentElement;
	}
	return false;
}

/** Re-runs the page's loaders and waits for the deferred data they return. */
async function refreshPage(router: AnyRouter) {
	await router.invalidate();
	const pending = router.state.matches.flatMap((match) =>
		match.loaderData && typeof match.loaderData === "object"
			? Object.values(match.loaderData).filter(
					(value): value is Promise<unknown> => value instanceof Promise,
				)
			: [],
	);
	await Promise.allSettled(pending);
}

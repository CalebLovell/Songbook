import { Link, useRouteContext, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { NavDot } from "~/components/sidebar/sidebar-nav.tsx";
import { SidebarBody } from "~/components/sidebar/site-sidebar.tsx";
import { SongbookWordmark } from "~/components/sidebar/songbook-wordmark.tsx";
import { useHealthMark } from "~/lib/use-health-mark.ts";
import { returnFocusTo } from "~/lib/use-return-focus.ts";

export function MobileNav() {
	const [isOpen, setIsOpen] = useState(false);
	const { auth } = useRouteContext({ from: "__root__" });
	const healthMark = useHealthMark(auth.unlocked);
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const [seenPathname, setSeenPathname] = useState(pathname);
	if (pathname !== seenPathname) {
		setSeenPathname(pathname);
		setIsOpen(false);
	}

	useEffect(() => {
		if (!isOpen) return;
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") setIsOpen(false);
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [isOpen]);

	const drawer = useRef<HTMLDivElement>(null);
	const closeButton = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		const panel = drawer.current;
		if (!isOpen || !panel) return;
		const opener = document.activeElement;
		const released = makeRestOfPageInert(panel);
		closeButton.current?.focus();
		return () => {
			released();
			returnFocusTo(opener);
		};
	}, [isOpen]);

	return (
		<>
			<div className={BAR_CLASS}>
				<button
					type="button"
					onClick={() => setIsOpen(true)}
					aria-label="Open navigation"
					aria-expanded={isOpen}
					className={`relative ${ROUND_BUTTON_CLASS}`}
				>
					<Menu className="size-5" aria-hidden="true" />
					{healthMark ? (
						<NavDot
							className="absolute top-1.5 right-1.5 ring-2 ring-paper-raised"
							attention={healthMark}
						/>
					) : null}
				</button>
				<SiteName />
				<div id={MENU_BAR_SLOT_ID} className="ml-auto flex items-center" />
			</div>

			<div
				ref={drawer}
				inert={!isOpen}
				role="dialog"
				aria-modal="true"
				aria-label="Navigation"
				className={`fixed inset-0 z-40 xl:hidden ${
					isOpen
						? "visible"
						: "invisible transition-[visibility] duration-300 motion-reduce:duration-0"
				}`}
			>
				<button
					type="button"
					aria-hidden="true"
					tabIndex={-1}
					onClick={() => setIsOpen(false)}
					className={`absolute inset-0 h-full w-full bg-[color-mix(in_oklab,var(--shade)_35%,transparent)] ${
						isOpen ? "opacity-100" : "opacity-0"
					}`}
				/>
				<div
					className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-line border-r bg-paper-raised transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
						isOpen ? "translate-x-0" : "-translate-x-full"
					}`}
				>
					<div className={DRAWER_BAR_CLASS}>
						<SiteName onClick={() => setIsOpen(false)} />
						<button
							ref={closeButton}
							type="button"
							onClick={() => setIsOpen(false)}
							aria-label="Close navigation"
							className={`ml-auto ${ROUND_BUTTON_CLASS}`}
						>
							<X className="size-5" aria-hidden="true" />
						</button>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<SidebarBody
							withTitle={false}
							onNavigate={() => setIsOpen(false)}
						/>
					</div>
				</div>
			</div>
		</>
	);
}

function makeRestOfPageInert(panel: HTMLElement) {
	const madeInert: Element[] = [];
	for (
		let node: HTMLElement | null = panel;
		node && node !== document.body;
		node = node.parentElement
	) {
		for (const sibling of node.parentElement?.children ?? []) {
			if (sibling === node || sibling.hasAttribute("inert")) continue;
			if (sibling.id === LIVE_ANNOUNCER_ID) continue;
			sibling.setAttribute("inert", "");
			madeInert.push(sibling);
		}
	}
	return () => {
		for (const element of madeInert) element.removeAttribute("inert");
	};
}

const LIVE_ANNOUNCER_ID = "live-announcer";
const MENU_BAR_SLOT_ID = "menu-bar-actions";

export function InMenuBar({ children }: { children: ReactNode }) {
	const [slot, setSlot] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setSlot(document.getElementById(MENU_BAR_SLOT_ID));
	}, []);
	return slot ? createPortal(children, slot) : null;
}

const BAR_BASE_CLASS =
	"z-30 flex h-14 shrink-0 items-center gap-2 border-line border-b bg-paper-raised xl:hidden";
const BAR_CLASS = `${BAR_BASE_CLASS} px-4 max-[400px]:px-2`;
const DRAWER_BAR_CLASS = `${BAR_BASE_CLASS} px-3`;

const ROUND_BUTTON_CLASS =
	"flex size-8 pointer-coarse:size-9 items-center justify-center rounded-full bg-paper-raised text-moss  hover:bg-[color-mix(in_oklab,var(--moss)_8%,var(--paper-raised))]";

function SiteName({ onClick }: { onClick?: () => void }) {
	return (
		<Link
			to="/"
			onClick={onClick}
			className="flex h-8 pointer-coarse:h-9 items-center gap-2 rounded-md px-2 font-semibold text-lg no-underline hover:bg-[color-mix(in_oklab,var(--moss)_8%,var(--paper-raised))]"
		>
			<SongbookWordmark className="shrink-0 text-[24px] text-moss" />
		</Link>
	);
}

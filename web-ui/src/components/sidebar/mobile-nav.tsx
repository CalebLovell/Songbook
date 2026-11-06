import { Link, useRouteContext, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { UpdateDot } from "~/components/sidebar/sidebar-nav.tsx";
import { SidebarBody } from "~/components/sidebar/site-sidebar.tsx";
import { SongbookWordmark } from "~/components/sidebar/songbook-wordmark.tsx";
import { useUpdateOffered } from "~/lib/use-update-offered.ts";

export function MobileNav() {
	const [isOpen, setIsOpen] = useState(false);
	const { auth } = useRouteContext({ from: "__root__" });
	const offered = useUpdateOffered(auth.unlocked);
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
					{offered ? (
						<UpdateDot
							className="absolute top-1.5 right-1.5 ring-2 ring-paper-raised"
							label={`Update to ${offered} available`}
						/>
					) : null}
				</button>
				<SiteName />
				<div id={MENU_BAR_SLOT_ID} className="ml-auto flex items-center" />
			</div>

			<div
				inert={!isOpen}
				className={`fixed inset-0 z-40 transition-[visibility] duration-300 motion-reduce:duration-0 xl:hidden ${
					isOpen ? "visible" : "invisible"
				}`}
			>
				<button
					type="button"
					aria-label="Close navigation"
					tabIndex={-1}
					onClick={() => setIsOpen(false)}
					className={`absolute inset-0 h-full w-full bg-[color-mix(in_oklab,var(--ink)_35%,transparent)] ${
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

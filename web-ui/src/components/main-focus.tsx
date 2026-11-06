import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { announce } from "~/lib/announce.ts";
import { focusMainContent, MAIN_CONTENT_ID } from "~/lib/main-content.ts";
import { SITE_NAME } from "~/lib/page-title.ts";

const SCROLL_KEYS = new Set([
	"ArrowDown",
	"ArrowUp",
	"End",
	"Home",
	"PageDown",
	"PageUp",
	" ",
]);
const TITLE_SETTLE_MS = 150;

export function MainFocus() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const seenPathname = useRef(pathname);

	useEffect(() => {
		if (pathname === seenPathname.current) return;
		seenPathname.current = pathname;
		const main = document.getElementById(MAIN_CONTENT_ID);
		const active = document.activeElement;
		if (!main?.contains(active) || active === main) focusMainContent();
		const timer = setTimeout(() => {
			announce(document.title.replace(`${SITE_NAME} – `, ""));
		}, TITLE_SETTLE_MS);
		return () => clearTimeout(timer);
	}, [pathname]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (document.activeElement !== document.body) return;
			if (event.altKey || event.ctrlKey || event.metaKey) return;
			if (SCROLL_KEYS.has(event.key)) focusMainContent();
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);

	return null;
}

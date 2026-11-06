import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	ScriptOnce,
	Scripts,
} from "@tanstack/react-router";
import { PullToRefresh } from "~/components/pull-to-refresh.tsx";
import { RouteError, RouteNotFound } from "~/components/root-status.tsx";
import { MobileNav } from "~/components/sidebar/mobile-nav.tsx";
import { SiteSidebar } from "~/components/sidebar/site-sidebar.tsx";
import { Toaster } from "~/components/ui/toaster.tsx";
import {
	defaultPreviewImage,
	previewImageMeta,
	previewTextMeta,
	STATION_DESCRIPTION,
} from "~/lib/link-preview.ts";
import { pageTitle, SITE_NAME } from "~/lib/page-title.ts";
import { stationOrigin } from "~/lib/station-origin.ts";
import { stationTimeZoneScript } from "~/lib/station-time.ts";
import { unlockStatusForNavigation } from "~/lib/unlock-status.ts";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	beforeLoad: async () => ({ auth: await unlockStatusForNavigation() }),
	head: ({ match }) => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: pageTitle(),
			},
			...previewTextMeta(pageTitle(), STATION_DESCRIPTION),
			{ property: "og:type", content: "website" },
			{
				property: "og:site_name",
				content: match.context.auth.siteName || SITE_NAME,
			},
			...previewImageMeta(defaultPreviewImage(stationOrigin())),
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/songbook.svg",
			},
			{
				rel: "apple-touch-icon",
				href: "/apple-touch-icon.png",
			},
			{
				rel: "manifest",
				href: "/manifest.webmanifest",
			},
		],
	}),
	notFoundComponent: RouteNotFound,
	errorComponent: RouteError,
	shellComponent: RootDocument,
});

const SCROLLBAR_PROBE = `(() => {
	const probe = document.createElement("div");
	probe.style.cssText = "position:absolute;visibility:hidden;width:100px;height:100px;overflow:scroll";
	document.documentElement.appendChild(probe);
	const width = probe.offsetWidth - probe.clientWidth;
	probe.remove();
	const style = document.createElement("style");
	style.textContent = ":root{--scrollbar-w:" + width + "px}";
	document.head.appendChild(style);
})()`;

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
				<ScriptOnce>{SCROLLBAR_PROBE}</ScriptOnce>
				<ScriptOnce>{stationTimeZoneScript()}</ScriptOnce>
			</head>
			<body>
				<div className="fixed inset-0 flex overflow-hidden">
					<SiteSidebar />
					<div className="flex min-h-0 min-w-0 flex-1 flex-col">
						<MobileNav />
						<PullToRefresh>
							<main
								id="app-scroll"
								className="scrollbar-gutter-stable min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
							>
								{children}
							</main>
						</PullToRefresh>
					</div>
				</div>
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}

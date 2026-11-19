import { Link, useRouteContext } from "@tanstack/react-router";

import { SidebarNav } from "~/components/sidebar/sidebar-nav.tsx";
import { SiteSearch } from "~/components/sidebar/site-search.tsx";
import { SongbookWordmark } from "~/components/sidebar/songbook-wordmark.tsx";
import { Card } from "~/components/ui/card.tsx";

export function SidebarBody({
	onNavigate,
	withTitle = true,
}: {
	onNavigate?: () => void;
	withTitle?: boolean;
}) {
	const { auth } = useRouteContext({ from: "__root__" });
	return (
		<div className={`flex min-h-full flex-col ${withTitle ? "" : "pt-3"}`}>
			{withTitle ? (
				<>
					<div className="flex h-[calc(var(--masthead-h)-2px)] p-2">
						<Link
							to="/"
							onClick={onNavigate}
							className="flex flex-1 flex-col items-start rounded-sm px-3.5 pt-2 no-underline"
						>
							<SongbookWordmark className="shrink-0 text-[24px] text-moss" />
							{auth.siteName ? (
								<span className="mt-0.5 text-muted-foreground text-xs leading-4">
									{auth.siteName}
								</span>
							) : null}
						</Link>
					</div>
					<div aria-hidden="true" className="mb-page h-px bg-line" />
				</>
			) : null}

			<SiteSearch onNavigate={onNavigate} />

			<SidebarNav onNavigate={onNavigate} />
		</div>
	);
}

export function SiteSidebar() {
	return (
		<aside className="hidden h-full shrink-0 py-4 pl-4 xl:block">
			<Card className="h-full w-64 overflow-y-auto p-0">
				<SidebarBody />
			</Card>
		</aside>
	);
}

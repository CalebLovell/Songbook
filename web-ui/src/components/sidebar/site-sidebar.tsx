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
		<div className="flex min-h-full flex-col py-3">
			{withTitle ? (
				<>
					<Link
						to="/"
						onClick={onNavigate}
						className="flex h-[calc(var(--masthead-h)-14px)] flex-col items-start px-[1.375rem] pt-1 pb-3 no-underline"
					>
						<SongbookWordmark className="shrink-0 text-[24px] text-moss" />
						{auth.siteName ? (
							<span className="mt-0.5 text-muted-foreground text-xs">
								{auth.siteName}
							</span>
						) : null}
					</Link>
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

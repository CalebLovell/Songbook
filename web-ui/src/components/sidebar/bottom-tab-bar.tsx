import { Link } from "@tanstack/react-router";

import { EXPLORE_LINKS } from "~/components/sidebar/explore-links.ts";

const TAB_CLASS =
	"group box-content flex h-15 min-w-0 flex-1 flex-col items-center justify-center gap-1.5 pb-[env(safe-area-inset-bottom)] font-medium text-[0.6875rem] text-[color-mix(in_oklab,var(--ink)_70%,var(--moss)_30%)] leading-none no-underline hover:bg-meadow hover:text-ink data-[status=active]:bg-[color-mix(in_oklab,var(--moss)_10%,var(--meadow))] data-[status=active]:text-ink";

export function BottomTabBar() {
	return (
		<nav
			aria-label="Explore"
			className="z-30 flex shrink-0 divide-x divide-line border-line border-t bg-paper-raised xl:hidden"
		>
			{EXPLORE_LINKS.map(({ label, icon: Icon, link }) => (
				<Link key={label} {...link} className={TAB_CLASS}>
					<Icon
						aria-hidden="true"
						className="size-5 opacity-75 group-data-[status=active]:opacity-100"
					/>
					<span className="max-w-full truncate px-0.5">{label}</span>
				</Link>
			))}
		</nav>
	);
}

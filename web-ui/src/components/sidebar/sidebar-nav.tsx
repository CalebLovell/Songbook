import { Link, useRouteContext } from "@tanstack/react-router";
import {
	Activity,
	AudioWaveform,
	CalendarRange,
	CircleUserRound,
	Feather,
	Lightbulb,
	type LucideIcon,
	SearchCheck,
	Settings,
	SlidersHorizontal,
} from "lucide-react";
import { useId } from "react";

import { ThemeSwitcher } from "~/components/sidebar/theme-switcher.tsx";
import { useSettingsMark } from "~/lib/use-settings-mark.ts";

const NAV_ROW_CLASS =
	"group flex min-h-8.5 pointer-coarse:min-h-9 items-center gap-2.5 pointer-coarse:gap-3 rounded-(--radius) px-3 text-[0.875rem] text-[color-mix(in_oklab,var(--ink)_70%,var(--moss)_30%)] pointer-coarse:text-[1rem] no-underline hover:bg-meadow hover:text-ink data-[status=active]:bg-[color-mix(in_oklab,var(--moss)_10%,var(--meadow))] data-[status=active]:text-ink";

function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
	return (
		<Icon
			aria-hidden="true"
			className="pointer-coarse:size-4.5 size-4 flex-none opacity-75 group-data-[status=active]:opacity-100"
		/>
	);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
	const linkProps = {
		className: NAV_ROW_CLASS,
		onClick: onNavigate,
	};

	const { auth } = useRouteContext({ from: "__root__" });
	const id = useId();
	const settingsMark = useSettingsMark(auth.unlocked);

	return (
		<div className="flex flex-1 flex-col px-3">
			<nav
				className="mt-1 flex flex-col gap-0.5"
				aria-labelledby={`${id}-explore`}
			>
				<SectionLabel id={`${id}-explore`}>Explore</SectionLabel>
				<Link to="/live" {...linkProps}>
					<NavIcon icon={Activity} />
					Live Feed
				</Link>
				<Link
					to="/timeline"
					activeOptions={{ includeSearch: false }}
					{...linkProps}
				>
					<NavIcon icon={CalendarRange} />
					Timeline
				</Link>
				<Link to="/birds" {...linkProps}>
					<NavIcon icon={Feather} />
					All Birds
				</Link>
				<Link to="/learn" {...linkProps}>
					<NavIcon icon={Lightbulb} />
					Learn
				</Link>
			</nav>

			{auth.unlocked ? (
				<nav
					className="mt-3 flex flex-col gap-0.5"
					aria-labelledby={`${id}-manage`}
				>
					<SectionLabel id={`${id}-manage`}>Manage</SectionLabel>
					<Link
						to="/detections"
						search={{
							page: 1,
							sort: "recorded",
							direction: "desc",
						}}
						activeOptions={{ includeSearch: false }}
						{...linkProps}
					>
						<NavIcon icon={AudioWaveform} />
						Detections
					</Link>
					<Link
						to="/review"
						search={{ page: 1 }}
						activeOptions={{ includeSearch: false }}
						{...linkProps}
					>
						<NavIcon icon={SearchCheck} />
						Review
					</Link>
				</nav>
			) : null}

			<nav
				className="mt-auto flex flex-col gap-0.5 pt-4"
				aria-labelledby={`${id}-station`}
			>
				<SectionLabel id={`${id}-station`}>Station</SectionLabel>
				<Link to="/account" {...linkProps}>
					<NavIcon icon={CircleUserRound} />
					Account
				</Link>
				{auth.unlocked ? (
					<>
						<Link
							to="/species-control"
							search={{ page: 1, sort: "species", direction: "asc" }}
							activeOptions={{ includeSearch: false }}
							{...linkProps}
						>
							<NavIcon icon={SlidersHorizontal} />
							Species Control
						</Link>
						<Link to="/settings" {...linkProps}>
							<NavIcon icon={Settings} />
							Settings
							{settingsMark ? (
								<SettingsDot className="ml-auto" label={settingsMark} />
							) : null}
						</Link>
					</>
				) : null}
			</nav>

			<div className="pt-page">
				<ThemeSwitcher />
			</div>
		</div>
	);
}

export function SettingsDot({
	label,
	className = "",
}: {
	label: string;
	className?: string;
}) {
	return (
		<span
			role="img"
			aria-label={label}
			title={label}
			className={`size-2 shrink-0 rounded-full bg-moss ${className}`}
		/>
	);
}

function SectionLabel({ id, children }: { id: string; children: string }) {
	return (
		<h2
			id={id}
			className="m-0 -mx-3 flex items-center gap-2 pb-2 font-bold text-[0.69rem] text-kicker leading-none"
		>
			<span aria-hidden="true" className="h-px w-6 bg-line" />
			{children}
			<span aria-hidden="true" className="h-px flex-1 bg-line" />
		</h2>
	);
}

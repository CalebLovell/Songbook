import { Link, useRouteContext } from "@tanstack/react-router";
import {
	Activity,
	AudioWaveform,
	CalendarRange,
	CircleUserRound,
	Feather,
	Lightbulb,
	SearchCheck,
	Settings,
	SlidersHorizontal,
} from "lucide-react";
import { useId } from "react";

import { useUpdateOffered } from "~/lib/use-update-offered.ts";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
	const linkProps = {
		className: "sidebar-link",
		activeProps: { className: "sidebar-link is-active" },
		onClick: onNavigate,
	};

	const { auth } = useRouteContext({ from: "__root__" });
	const id = useId();
	const offered = useUpdateOffered(auth.unlocked);

	return (
		<div className="flex flex-1 flex-col px-3">
			<nav
				className="mt-1 flex flex-col gap-0.5"
				aria-labelledby={`${id}-explore`}
			>
				<SectionLabel id={`${id}-explore`}>Explore</SectionLabel>
				<Link to="/live" {...linkProps}>
					<Activity className="sidebar-icon" aria-hidden="true" />
					Live Feed
				</Link>
				<Link
					to="/timeline"
					activeOptions={{ includeSearch: false }}
					{...linkProps}
				>
					<CalendarRange className="sidebar-icon" aria-hidden="true" />
					Timeline
				</Link>
				<Link to="/birds" {...linkProps}>
					<Feather className="sidebar-icon" aria-hidden="true" />
					All Birds
				</Link>
				<Link to="/learn" {...linkProps}>
					<Lightbulb className="sidebar-icon" aria-hidden="true" />
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
							pageSize: 100,
							sort: "recorded",
							direction: "desc",
						}}
						activeOptions={{ includeSearch: false }}
						{...linkProps}
					>
						<AudioWaveform className="sidebar-icon" aria-hidden="true" />
						Detections
					</Link>
					<Link
						to="/review"
						search={{ page: 1 }}
						activeOptions={{ includeSearch: false }}
						{...linkProps}
					>
						<SearchCheck className="sidebar-icon" aria-hidden="true" />
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
					<CircleUserRound className="sidebar-icon" aria-hidden="true" />
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
							<SlidersHorizontal className="sidebar-icon" aria-hidden="true" />
							Species Control
						</Link>
						<Link to="/settings" {...linkProps}>
							<Settings className="sidebar-icon" aria-hidden="true" />
							Settings
							{offered ? (
								<UpdateDot
									className="ml-auto"
									label={`Update to ${offered} available`}
								/>
							) : null}
						</Link>
					</>
				) : null}
			</nav>
		</div>
	);
}

export function UpdateDot({
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

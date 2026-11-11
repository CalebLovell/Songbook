import { useQuery } from "@tanstack/react-query";
import { Link, useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ShellSized } from "~/components/ui/shell.tsx";
import { APP_VERSION, REPO_URL } from "~/lib/app-version.ts";
import {
	type StationStatus,
	stationStatusQuery,
} from "~/lib/station-status.ts";

const STATUS_LABEL: Record<StationStatus, string> = {
	live: "Listening",
	offline: "Offline",
	unknown: "Unknown",
};

const STATUS_HINT: Record<StationStatus, string> = {
	live: "Recording and identifying birds right now.",
	offline: "BirdNET's recording or analysis service isn't running.",
	unknown: "The station's services couldn't be checked from here.",
};

function HealthLink({
	className,
	title,
	children,
}: {
	className: string;
	title?: string;
	children: ReactNode;
}) {
	return (
		<Link
			to="/health"
			title={title}
			className={`${className} no-underline hover:underline`}
		>
			{children}
		</Link>
	);
}

export function SidebarStatusBar({ className = "" }: { className?: string }) {
	const status = useQuery(stationStatusQuery).data;
	const { auth } = useRouteContext({ from: "__root__" });
	const isLive = status === "live";
	const StatusTag = auth.unlocked ? HealthLink : "p";
	return (
		<div
			className={`flex items-center gap-1.5 border-line border-t py-2.5 text-xs ${className}`}
		>
			<StatusTag
				className="m-0 flex items-center gap-1.5"
				title={status ? STATUS_HINT[status] : undefined}
			>
				<span
					aria-hidden="true"
					className="relative inline-flex size-2 shrink-0 items-center justify-center"
				>
					{isLive ? (
						<span className="absolute inset-0 animate-live-ping rounded-full bg-moss" />
					) : null}
					<span
						className={`relative size-2 rounded-full ${
							isLive ? "bg-moss" : "bg-muted-foreground opacity-60"
						}`}
					/>
				</span>
				{status ? (
					<span
						className={
							isLive ? "font-semibold text-moss" : "text-muted-foreground"
						}
					>
						{STATUS_LABEL[status]}
					</span>
				) : (
					<ShellSized className="rounded-sm">
						<span className="font-semibold">{STATUS_LABEL.live}</span>
					</ShellSized>
				)}
			</StatusTag>
			<a
				href={REPO_URL}
				target="_blank"
				rel="noreferrer"
				className="ml-auto whitespace-nowrap text-muted-foreground no-underline hover:text-ink hover:underline"
			>
				Songbook{APP_VERSION ? ` ${APP_VERSION}` : ""}
			</a>
		</div>
	);
}

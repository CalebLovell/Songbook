import { useQuery } from "@tanstack/react-query";

import { ShellSized } from "~/components/ui/shell.tsx";
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

export function StationStatusLine({ className = "" }: { className?: string }) {
	const status = useQuery(stationStatusQuery).data;
	const isLive = status === "live";
	return (
		<p
			className={`flex items-center gap-1.5 text-xs ${className}`}
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
					className={`shrink-0 ${isLive ? "font-semibold text-moss" : "text-muted-foreground"}`}
				>
					{STATUS_LABEL[status]}
				</span>
			) : (
				<ShellSized className="rounded-sm">
					<span className="font-semibold">{STATUS_LABEL.live}</span>
				</ShellSized>
			)}
		</p>
	);
}

import { ShellSized } from "~/components/ui/shell.tsx";
import type { StationStatus } from "~/lib/station-status.ts";

const PILL_CLASS =
	"flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold text-[10px] uppercase tracking-[0.14em]";

export function LivePill({ status }: { status: StationStatus }) {
	if (status === "live") {
		return (
			<span
				className={PILL_CLASS}
				style={{ backgroundColor: "var(--live-fill)", color: "var(--moss)" }}
			>
				<span
					className="inline-block size-2 animate-live-pulse rounded-full bg-moss"
					aria-hidden="true"
				/>
				Live
			</span>
		);
	}
	return (
		<span
			className={`${PILL_CLASS} bg-muted text-muted-foreground`}
			title={
				status === "offline"
					? "BirdNET's recording or analysis service isn't running."
					: "The station's services couldn't be checked from here."
			}
		>
			<span
				className="inline-block size-2 rounded-full bg-current opacity-60"
				aria-hidden="true"
			/>
			{status === "offline" ? "Offline" : "Unknown"}
		</span>
	);
}

export function LivePillSkeleton() {
	return (
		<ShellSized className="rounded-full">
			<LivePill status="live" />
		</ShellSized>
	);
}

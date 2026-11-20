import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesImage } from "~/components/species-image.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { formatDateTime } from "~/lib/date-format.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { formatTimeAgo } from "~/lib/time-ago.ts";
import type { CurrentBird } from "~/lib/today.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useCanListen } from "~/lib/use-can-listen.ts";
import { cn } from "~/lib/utils.ts";

const LABEL = "Now hearing";
const HEADER_ROW =
	"grid items-center gap-page sm:min-h-31 sm:grid-cols-[9.5rem_minmax(0,1fr)]";
const PORTRAIT_SLOT = "flex h-30 w-full shrink-0 items-center justify-center";
const TEXT_COLUMN =
	"flex min-w-0 flex-col gap-2.5 max-[400px]:gap-2 sm:justify-between sm:self-stretch";
const SAMPLE_HEARD_AT = "last heard Nov 17, 2026, 10:45 AM";

function HeaderCard({
	portrait,
	className,
	busy,
	children,
}: {
	portrait: ReactNode;
	className?: string;
	busy?: boolean;
	children: ReactNode;
}) {
	return (
		<Card
			as="section"
			aria-label={LABEL}
			aria-busy={busy || undefined}
			className={className}
		>
			<div className={HEADER_ROW}>
				{portrait}
				<div className={TEXT_COLUMN}>{children}</div>
			</div>
		</Card>
	);
}

export function TodayHeaderShell() {
	return (
		<HeaderCard
			busy
			portrait={
				<div className={PORTRAIT_SLOT}>
					<ShellBar className="size-full rounded-md" />
				</div>
			}
		>
			<HeaderTextShell />
		</HeaderCard>
	);
}

function HeaderTextShell() {
	const canListen = useCanListen();
	return (
		<>
			<div className="min-w-0">
				<ShellText
					className="font-bold text-2xl sm:text-3xl"
					barClassName="w-60 max-w-full"
				/>
				<ShellText className="text-xs" barClassName="w-32" />
			</div>
			<div>
				<ShellText className="font-semibold text-lg" barClassName="w-32" />
				<div className="mt-1 flex flex-wrap items-center gap-2 text-sm tabular-nums">
					<ShellText
						className="w-fit max-w-full"
						barClassName="right-0"
						strut={<span className="invisible">{SAMPLE_HEARD_AT}</span>}
					/>
					<ShellSized className="rounded-full">
						<ConfidencePill confidence={0.9} />
					</ShellSized>
					{canListen ? (
						<ShellSized className="rounded-md">
							<RecordingButton audioUrl={null} size="sm" />
						</ShellSized>
					) : null}
				</div>
			</div>
		</>
	);
}

export function TodayHeader({
	current,
	hasAnyDetections,
	generatedAt,
	flash,
}: {
	current: CurrentBird | null;
	hasAnyDetections: boolean;
	generatedAt: string;
	flash: boolean;
}) {
	const offsetMs = useAgeOffset(generatedAt);
	const canListen = useCanListen();

	if (!current) {
		return (
			<HeaderCard portrait={<NestPortrait />}>
				<StandIn>
					<h1 className="font-bold text-2xl sm:text-3xl">
						{hasAnyDetections
							? EMPTY.window.liveQuietTitle
							: EMPTY.station.liveHeroTitle}
					</h1>
					<p className="text-muted-foreground">
						{hasAnyDetections
							? EMPTY.window.liveQuietBody
							: EMPTY.station.liveHeroBody}
					</p>
				</StandIn>
			</HeaderCard>
		);
	}

	return (
		<HeaderCard
			className={cn(flash && "animate-flash-in")}
			portrait={
				<div className={`${PORTRAIT_SLOT} overflow-hidden`}>
					<SpeciesImage
						imageUrl={current.imageUrl}
						alt={current.comName}
						glyphClassName="size-16"
						cropToPainting
					/>
				</div>
			}
		>
			<div className="min-w-0">
				<h1 className="font-bold text-2xl text-moss sm:text-3xl">
					<Link
						to="/birds/$comName"
						params={{ comName: current.speciesSlug }}
						className="no-underline hover:underline"
					>
						{current.comName}
					</Link>
				</h1>
				<p className="text-bark text-xs italic">{current.sciName}</p>
			</div>
			<div>
				<p className="font-semibold text-lg text-moss">
					{formatTimeAgo(current.ageMs + offsetMs)}
				</p>
				<div className="mt-1 flex flex-wrap items-center gap-2 text-sm tabular-nums">
					<span className="text-muted-foreground">
						last heard {formatDateTime(current.detectedAt)}
					</span>
					<ConfidencePill confidence={current.confidence} />
					{canListen ? (
						<RecordingButton
							audioUrl={current.audioUrl}
							speciesName={current.comName}
							size="sm"
						/>
					) : null}
				</div>
			</div>
		</HeaderCard>
	);
}

function StandIn({ children }: { children: ReactNode }) {
	return (
		<div className="grid">
			<div
				aria-hidden="true"
				inert
				className={`invisible col-start-1 row-start-1 ${TEXT_COLUMN}`}
			>
				<HeaderTextShell />
			</div>
			<div className="col-start-1 row-start-1 flex min-w-0 flex-col justify-center gap-2">
				{children}
			</div>
		</div>
	);
}

function NestPortrait() {
	return (
		<div className={`${PORTRAIT_SLOT} overflow-hidden`}>
			<img
				src="/illustrations/nest.webp"
				alt="An empty nest"
				className="max-h-full max-w-full object-contain"
			/>
		</div>
	);
}

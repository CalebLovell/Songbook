import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { CardHeader } from "~/components/card-header.tsx";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { RECENT_LIMIT, type RecentVisit } from "~/lib/now.ts";
import { formatClockRange, formatTimeAgo } from "~/lib/time-ago.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useCanListen } from "~/lib/use-can-listen.ts";
import { VISIT_GAP_MINUTES } from "~/lib/visits.ts";

const CARD_CLASS = "@container feature-card flex flex-col rounded-md p-4";
const ROW_CLASS =
	"flex items-center @min-[26rem]:gap-3 gap-2 px-(--page-gap) py-1.75";
const TIME_COLUMN_CLASS = "@min-[26rem]:block hidden shrink-0 text-right";
const ROW_BUTTON = {
	size: "sm" as const,
	labelClassName: "@min-[26rem]:inline hidden",
	className: "@min-[26rem]:w-auto w-7 @min-[26rem]:px-3 px-0",
};
const FOOTER_CLASS =
	"-mx-(--page-gap) mt-auto -mb-(--page-gap) flex min-h-[45px] shrink-0 items-center justify-end border-t px-(--page-gap)";
const FOOTER_LINK_CLASS =
	"inline-flex items-center gap-1 text-muted-foreground text-xs no-underline hover:text-foreground hover:underline";

function RecentLogHeader() {
	return (
		<CardHeader title="Recent activity">
			<InfoTip label="Recent activity" size="default">
				<p>
					The live activity from your station is updated here in real time, and
					detections are listed from most recent to least recent. Visits are
					combined when the same bird is heard repeatedly without a{" "}
					{VISIT_GAP_MINUTES} minute gap.
				</p>
				<p>
					Each row displays the species, number of detections, when they were
					heard, and the confidence percentile assigned by the BirdNET
					algorithm. The link in the bottom right redirects to the complete
					timeline view for the day.
				</p>
			</InfoTip>
		</CardHeader>
	);
}

function RecentLogFooter() {
	return (
		<div className={FOOTER_CLASS}>
			<Link to="/timeline" className={FOOTER_LINK_CLASS}>
				All of today
				<ArrowRight aria-hidden className="size-3" />
			</Link>
		</div>
	);
}

export function RecentLogCardSkeleton() {
	const canListen = useCanListen();
	return (
		<section
			aria-busy="true"
			aria-label="Recent detections"
			className={CARD_CLASS}
		>
			<RecentLogHeader />
			<ul aria-hidden="true" className="-mx-(--page-gap) divide-y">
				{Array.from({ length: RECENT_LIMIT }, (_, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static decoration
					<li key={index} className={ROW_CLASS}>
						<div className="flex size-10 shrink-0 items-center justify-center">
							<ShellBar className="size-9 rounded-md" />
						</div>
						<div className="min-w-0 flex-1">
							<ShellText
								className="font-medium"
								barClassName={NAME_WIDTHS[index % NAME_WIDTHS.length]}
							/>
							<ShellText className="text-xs" barClassName="w-24" />
						</div>
						<div className={TIME_COLUMN_CLASS}>
							<ShellText
								className="w-20 text-sm"
								barClassName="right-0 left-auto w-16"
							/>
							<ShellText
								className="w-20 text-xs"
								barClassName="right-0 left-auto w-20"
							/>
						</div>
						<ShellSized className="rounded-full">
							<ConfidencePill confidence={0.9} className="shrink-0" />
						</ShellSized>
						{canListen ? (
							<ShellSized className="rounded-md">
								<RecordingButton audioUrl={null} {...ROW_BUTTON} />
							</ShellSized>
						) : null}
					</li>
				))}
			</ul>
			<RecentLogFooter />
		</section>
	);
}

const NAME_WIDTHS = ["w-36", "w-28", "w-44", "w-32", "w-40"];

export function RecentLogCard({
	recent,
	generatedAt,
	freshKeys,
}: {
	recent: RecentVisit[];
	generatedAt: string;
	freshKeys: Set<string>;
}) {
	const canListen = useCanListen();
	const offsetMs = useAgeOffset(generatedAt);

	return (
		<section aria-label="Recent detections" className={CARD_CLASS}>
			<RecentLogHeader />

			{recent.length === 0 ? (
				<EmptyNote>{EMPTY.window.last24Hours}</EmptyNote>
			) : (
				<ul className="-mx-(--page-gap) divide-y">
					{recent.map((visit) => {
						const clock = formatClockRange(visit.firstAt, visit.lastAt);
						const age = formatTimeAgo(visit.ageMs + offsetMs);

						return (
							<li
								key={visit.key}
								className={`${ROW_CLASS} ${freshKeys.has(visit.key) ? "flash-in" : ""}`}
							>
								<SpeciesThumbnail
									imageUrl={visit.imageUrl}
									comName={visit.comName}
								/>

								<div className="min-w-0 flex-1">
									<div className="flex min-w-0 items-baseline gap-1.5">
										<Link
											to="/birds/$comName"
											params={{ comName: visit.speciesSlug }}
											className="block min-w-0 max-w-fit truncate font-medium no-underline hover:underline"
										>
											{visit.comName}
										</Link>
										{visit.detections > 1 ? (
											<span
												className="count-figure shrink-0"
												title={`${visit.detections.toLocaleString()} detections in this visit`}
											>
												×{visit.detections.toLocaleString()}
											</span>
										) : null}
									</div>
									<div className="@min-[26rem]:block hidden truncate text-[var(--bark)] text-xs italic">
										{visit.sciName}
									</div>
									<div className="@min-[26rem]:hidden truncate text-muted-foreground text-xs tabular-nums">
										{age} · {clock}
									</div>
								</div>

								<div className={TIME_COLUMN_CLASS}>
									<div className="text-sm tabular-nums">{age}</div>
									<time
										dateTime={visit.lastAt.replace(" ", "T")}
										className="block text-muted-foreground text-xs tabular-nums"
									>
										{clock}
									</time>
								</div>

								<ConfidencePill
									confidence={visit.confidence}
									className="shrink-0"
								/>
								{canListen ? (
									<RecordingButton
										audioUrl={visit.audioUrl}
										speciesName={visit.comName}
										{...ROW_BUTTON}
									/>
								) : null}
							</li>
						);
					})}
				</ul>
			)}

			{recent.length > 0 ? <RecentLogFooter /> : null}
		</section>
	);
}

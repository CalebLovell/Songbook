import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import {
	CARD_HEADER_LINK_CLASS,
	CardHeader,
} from "~/components/card-header.tsx";
import { ConfidencePill } from "~/components/confidence-pill.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { RecordingButton } from "~/components/recording-button.tsx";
import { SpeciesThumbnail } from "~/components/species-row.tsx";
import { Card } from "~/components/ui/card.tsx";
import { Count } from "~/components/ui/count.tsx";
import { ShellBar, ShellSized, ShellText } from "~/components/ui/shell.tsx";
import { EMPTY } from "~/lib/empty-messages.ts";
import { RECENT_LIMIT, type RecentVisit, type ShownDay } from "~/lib/now.ts";
import { formatClockRange, formatTimeAgo } from "~/lib/time-ago.ts";
import { useAgeOffset } from "~/lib/use-age-offset.ts";
import { useCanListen } from "~/lib/use-can-listen.ts";

const CARD_CLASS = "@container flex flex-col";
const LISTED_CARD_CLASS = `${CARD_CLASS} pb-0`;
const ROW_CLASS = "flex items-center @min-[26rem]:gap-3 gap-2 px-page py-1.75";
const LIST_CLASS = "-mx-page divide-y";
const TIME_COLUMN_CLASS = "@min-[26rem]:block hidden shrink-0 text-right";
const ROW_BUTTON = {
	size: "sm" as const,
	labelClassName: "@min-[26rem]:inline hidden",
	className: "@min-[26rem]:w-auto w-7 @min-[26rem]:px-3 px-0",
};

function RecentLogHeader({ day, date }: { day: ShownDay; date?: string }) {
	return (
		<CardHeader title="Recent activity">
			<Link
				to="/timeline"
				search={date ? { period: "day", date } : undefined}
				className={CARD_HEADER_LINK_CLASS}
			>
				All of {day}
				<ArrowRight aria-hidden className="size-3" />
			</Link>
		</CardHeader>
	);
}

export function RecentLogCardSkeleton({ day }: { day: ShownDay }) {
	const canListen = useCanListen();
	return (
		<Card
			as="section"
			aria-busy="true"
			aria-label="Recent detections"
			className={LISTED_CARD_CLASS}
		>
			<RecentLogHeader day={day} />
			<ul aria-hidden="true" className={LIST_CLASS}>
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
		</Card>
	);
}

const NAME_WIDTHS = ["w-36", "w-28", "w-44", "w-32", "w-40"];

export function RecentLogCard({
	recent,
	day,
	date,
	generatedAt,
	freshKeys,
	limit,
}: {
	recent: RecentVisit[];
	day: ShownDay;
	date: string;
	generatedAt: string;
	freshKeys: Set<string>;
	limit?: number;
}) {
	const canListen = useCanListen();
	const offsetMs = useAgeOffset(generatedAt);

	return (
		<Card
			as="section"
			aria-label="Recent detections"
			className={recent.length > 0 ? LISTED_CARD_CLASS : CARD_CLASS}
		>
			<RecentLogHeader day={day} date={date} />

			{recent.length === 0 ? (
				<EmptyNote>{EMPTY.window.today}</EmptyNote>
			) : (
				<ul className={LIST_CLASS}>
					{recent.slice(0, limit).map((visit) => {
						const clock = formatClockRange(visit.firstAt, visit.lastAt);
						const age = formatTimeAgo(visit.ageMs + offsetMs);

						return (
							<li
								key={visit.key}
								className={`${ROW_CLASS} ${freshKeys.has(visit.key) ? "animate-flash-in" : ""}`}
							>
								<Link
									to="/birds/$comName"
									preload={false}
									params={{ comName: visit.speciesSlug }}
									tabIndex={-1}
									aria-hidden="true"
									className="shrink-0"
								>
									<SpeciesThumbnail
										imageUrl={visit.imageUrl}
										comName={visit.comName}
									/>
								</Link>

								<div className="min-w-0 flex-1">
									<div className="flex min-w-0 items-baseline gap-1.5">
										<Link
											to="/birds/$comName"
											preload={false}
											params={{ comName: visit.speciesSlug }}
											className="block min-w-0 max-w-fit truncate font-medium no-underline hover:underline"
										>
											{visit.comName}
										</Link>
										{visit.detections > 1 ? (
											<Count
												className="shrink-0"
												title={`${visit.detections.toLocaleString()} detections in this visit`}
											>
												×{visit.detections.toLocaleString()}
											</Count>
										) : null}
									</div>
									<div className="@min-[26rem]:block hidden truncate text-bark text-xs italic">
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
		</Card>
	);
}

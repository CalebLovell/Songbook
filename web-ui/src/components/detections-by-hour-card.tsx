import { type ReactNode, useId } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Tooltip as ChartTooltip,
	Line,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";
import { CardHeader } from "~/components/card-header.tsx";
import { ChartDataTable } from "~/components/chart-data-table.tsx";
import { ChartValueTooltip } from "~/components/chart-tooltip.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { InfoTip } from "~/components/ui/info-tip.tsx";
import { ShellChartCard } from "~/components/ui/shell.tsx";
import {
	CHART_ANIMATION_MS,
	CHART_MARGIN,
	X_AXIS_HEIGHT,
} from "~/lib/chart-style.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import type { HourActivity } from "~/lib/stats-data.ts";
import { hourLabel } from "~/lib/time-ago.ts";

const EVEN_HOURS = Array.from({ length: 12 }, (_, index) => index * 2);

function HourInfo({ info }: { info?: ReactNode }) {
	return info ? (
		<InfoTip label="Detections by hour" size="default">
			{info}
		</InfoTip>
	) : null;
}

export function DetectionsByHourCard({
	activity,
	emptyMessage = EMPTY.station.detections,
	info,
	className = "",
}: {
	activity: HourActivity[];
	emptyMessage?: string;
	info?: ReactNode;
	className?: string;
}) {
	const fillId = useId();

	const isEmpty = activity.every((point) => point.count === 0);

	if (isEmpty) {
		return (
			<section
				aria-label="Detections by hour"
				className={`feature-card flex flex-col rounded-md p-4 ${className}`}
			>
				<CardHeader title="Detections by hour">
					<HourInfo info={info} />
				</CardHeader>
				<EmptyNote>{emptyMessage}</EmptyNote>
			</section>
		);
	}

	return (
		<section
			aria-label="Detections by hour"
			className={`feature-card flex min-h-72 flex-col rounded-md p-4 ${className}`}
		>
			<CardHeader title="Detections by hour">
				<HourInfo info={info} />
			</CardHeader>

			<div className="mt-(--page-gap) min-h-0 flex-1">
				<ResponsiveContainer width="100%" height="100%" minHeight={220}>
					<AreaChart
						data={activity}
						margin={CHART_MARGIN}
						accessibilityLayer={false}
						aria-hidden
					>
						<defs>
							<linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="var(--moss)" stopOpacity={0.2} />
								<stop offset="100%" stopColor="var(--moss)" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid stroke="var(--line)" vertical={false} />
						<XAxis
							dataKey="hour"
							height={X_AXIS_HEIGHT}
							tickFormatter={hourLabel}
							stroke="var(--muted-foreground)"
							fontSize={12}
							tickLine={false}
							ticks={EVEN_HOURS}
							interval="preserveStart"
						/>
						<YAxis
							stroke="var(--muted-foreground)"
							fontSize={12}
							tickLine={false}
							allowDecimals={false}
							width="auto"
						/>
						<ChartTooltip
							content={(props) => (
								<ChartValueTooltip
									{...props}
									formatLabel={(hour) => hourLabel(Number(hour))}
								/>
							)}
							cursor={{ fill: "var(--sage)", fillOpacity: 0.2 }}
						/>
						<Area
							dataKey="count"
							tooltipType="none"
							animationDuration={CHART_ANIMATION_MS}
							stroke="none"
							fill={`url(#${fillId})`}
						/>
						<Line
							type="monotone"
							dataKey="count"
							animationDuration={CHART_ANIMATION_MS}
							stroke="var(--moss)"
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 3, fill: "var(--moss)" }}
						/>
					</AreaChart>
				</ResponsiveContainer>
				<ChartDataTable
					caption="Detections by hour"
					bucketHeading="Hour"
					rows={activity.map((point) => ({
						label: hourLabel(point.hour),
						count: point.count,
					}))}
				/>
			</div>
		</section>
	);
}

export function DetectionsByHourCardSkeleton({
	info,
	className = "",
}: {
	info?: ReactNode;
	className?: string;
}) {
	return (
		<ShellChartCard
			title="Detections by hour"
			ariaLabel="Detections by hour"
			action={<HourInfo info={info} />}
			className={className}
		/>
	);
}

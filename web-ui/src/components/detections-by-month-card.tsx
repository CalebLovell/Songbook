import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Tooltip as ChartTooltip,
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
import { CHART_MARGIN, X_AXIS_HEIGHT } from "~/lib/chart-style.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import type { TrendPoint } from "~/lib/stats-data.ts";

const INITIALS_BELOW_PX = 380;

function MonthInfo() {
	return (
		<InfoTip label="Detections by month" size="default">
			<p>
				This chart shows every detection of this bird by month of the year, with
				all the years the station has been listening added together. The tallest
				bars show the time of year it is heard most often, and the shortest show
				when it is most quiet.
			</p>
		</InfoTip>
	);
}

export function DetectionsByMonthCard({
	trend,
	className = "",
}: {
	trend: TrendPoint[];
	className?: string;
}) {
	const isEmpty = trend.every((point) => point.count === 0);
	const [initials, setInitials] = useState(false);

	return (
		<section
			aria-label="Detections by month"
			className={`feature-card flex flex-col rounded-md p-4 ${isEmpty ? "" : "min-h-72"} ${className}`}
		>
			<CardHeader title="Detections by month">
				<MonthInfo />
			</CardHeader>

			{isEmpty ? (
				<EmptyNote>{EMPTY.station.detections}</EmptyNote>
			) : (
				<div className="mt-page min-h-0 flex-1">
					<ResponsiveContainer
						width="100%"
						height="100%"
						minHeight={220}
						onResize={(width) => setInitials(width < INITIALS_BELOW_PX)}
					>
						<BarChart
							data={trend}
							accessibilityLayer={false}
							aria-hidden
							margin={CHART_MARGIN}
						>
							<CartesianGrid stroke="var(--line)" vertical={false} />
							<XAxis
								dataKey="label"
								height={X_AXIS_HEIGHT}
								stroke="var(--muted-foreground)"
								fontSize={12}
								tickLine={false}
								minTickGap={0}
								interval={0}
								tickFormatter={(month: string) =>
									initials ? month.charAt(0) : month
								}
							/>
							<YAxis
								stroke="var(--muted-foreground)"
								fontSize={12}
								tickLine={false}
								allowDecimals={false}
								width="auto"
							/>
							<ChartTooltip
								content={(props) => <ChartValueTooltip {...props} />}
								cursor={{ fill: "var(--sage)", fillOpacity: 0.2 }}
							/>
							{/* Animation stays off: recharts never finishes a bar's enter animation here, leaving a blank card. */}
							<Bar
								dataKey="count"
								isAnimationActive={false}
								fill="var(--moss)"
								radius={[4, 4, 0, 0]}
								maxBarSize={48}
							/>
						</BarChart>
					</ResponsiveContainer>
					<ChartDataTable
						caption="Detections by month"
						bucketHeading="Month"
						rows={trend}
					/>
				</div>
			)}
		</section>
	);
}

export function DetectionsByMonthCardSkeleton({
	className = "",
}: {
	className?: string;
}) {
	return (
		<ShellChartCard
			title="Detections by month"
			ariaLabel="Detections by month"
			action={<MonthInfo />}
			className={className}
		/>
	);
}

import {
	Bar,
	BarChart,
	type BarShapeProps,
	CartesianGrid,
	Tooltip as ChartTooltip,
	Rectangle,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from "recharts";

import { CardHeader } from "~/components/card-header.tsx";
import { ChartDataTable } from "~/components/chart-data-table.tsx";
import { ChartValueTooltip } from "~/components/chart-tooltip.tsx";
import { EmptyNote } from "~/components/empty-state.tsx";
import { Card } from "~/components/ui/card.tsx";
import { ShellChartCard } from "~/components/ui/shell.tsx";
import {
	CHART_ANIMATION_MS,
	CHART_MARGIN,
	X_AXIS_HEIGHT,
} from "~/lib/chart-style.ts";
import { EMPTY } from "~/lib/empty-messages.ts";
import { heatColor } from "~/lib/heatmap.ts";
import { useTheme } from "~/lib/theme.ts";
import { hourLabel } from "~/lib/time-ago.ts";
import { useReducedMotion } from "~/lib/use-reduced-motion.ts";

const TITLE = "Hourly activity";
// From xl the chart takes whatever height Recent activity leaves above it.
const FIT_CLASS = "min-h-72 xl:min-h-48 xl:flex-1";
export const HOUR_BARS_MIN_PX = 192;
// What a 192px card leaves for the plot under its header band and padding.
const CHART_MIN_PX = 96;
// A quiet hour keeps a stub so the day shows all 24 slots; any detection stands taller than it.
const STUB_PX = 3;
const MIN_BAR_PX = 6;
const EVEN_HOURS = Array.from({ length: 12 }, (_, index) => index * 2);

export function sumHours(rows: readonly { hourCounts: number[] }[]): number[] {
	return Array.from({ length: 24 }, (_, hour) =>
		rows.reduce((sum, row) => sum + (row.hourCounts[hour] ?? 0), 0),
	);
}

type HourDatum = { count: number | null };

export function HourBarsCardSkeleton() {
	return (
		<ShellChartCard title={TITLE} ariaLabel={TITLE} className={FIT_CLASS} />
	);
}

export function HourBarsCard({
	hours,
	lastHour,
}: {
	hours: number[];
	lastHour: number;
}) {
	const reducedMotion = useReducedMotion();
	const theme = useTheme();
	const peak = Math.max(...hours, 1);
	const data = hours.map((count, hour) => {
		const shown = hour > lastHour ? null : count;
		return { hour, count: shown, stub: shown ? null : 0 };
	});
	const barMinPx = (_: unknown, index: number) =>
		(data[index]?.count ?? 0) > 0 ? MIN_BAR_PX : 0;
	const stubMinPx = (_: unknown, index: number) =>
		data[index]?.stub == null ? 0 : STUB_PX;
	const heatBar = (bar: BarShapeProps) => (
		<Rectangle
			{...bar}
			fill={heatColor((bar.payload as HourDatum).count ?? 0, peak, theme)}
		/>
	);

	if (hours.every((count) => count === 0)) {
		return (
			<Card as="section" aria-label={TITLE} className="flex flex-col">
				<CardHeader title={TITLE} />
				<EmptyNote>{EMPTY.window.today}</EmptyNote>
			</Card>
		);
	}

	return (
		<Card
			as="section"
			aria-label={TITLE}
			className={`flex flex-col ${FIT_CLASS}`}
		>
			<CardHeader title={TITLE} />

			<div className="mt-page h-50 min-h-0 xl:h-auto xl:flex-1">
				<ResponsiveContainer
					width="100%"
					height="100%"
					minHeight={CHART_MIN_PX}
				>
					<BarChart
						data={data}
						margin={CHART_MARGIN}
						accessibilityLayer={false}
						aria-hidden
					>
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
						<Bar
							dataKey="count"
							stackId="hour"
							isAnimationActive={!reducedMotion}
							animationDuration={CHART_ANIMATION_MS}
							radius={[2, 2, 0, 0]}
							minPointSize={barMinPx}
							shape={heatBar}
						/>
						<Bar
							dataKey="stub"
							stackId="hour"
							tooltipType="none"
							isAnimationActive={false}
							radius={[1, 1, 0, 0]}
							minPointSize={stubMinPx}
							fill="var(--track)"
						/>
					</BarChart>
				</ResponsiveContainer>
				<ChartDataTable
					caption="Detections by hour"
					bucketHeading="Hour"
					rows={data
						.filter((point) => point.count !== null)
						.map((point) => ({
							label: hourLabel(point.hour),
							count: point.count ?? 0,
						}))}
				/>
			</div>
		</Card>
	);
}

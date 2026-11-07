import { heatColorAt } from "~/lib/heatmap.ts";
import { plural } from "~/lib/number-format.ts";
import { hourLabel } from "~/lib/time-ago.ts";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21] as const;

const MIN_BAR_PERCENT = 8;

function tickParts(hour: number): { number: string; meridiem: string } {
	if (hour === 0) return { number: "12", meridiem: "a" };
	if (hour < 12) return { number: String(hour), meridiem: "a" };
	if (hour === 12) return { number: "12", meridiem: "p" };
	return { number: String(hour - 12), meridiem: "p" };
}

export function SpeciesHourBars({
	comName,
	hourCounts,
	className = "",
}: {
	comName: string;
	hourCounts: number[];
	className?: string;
}) {
	const max = Math.max(...hourCounts, 0);
	if (max === 0) return null;

	const peakHour = hourCounts.reduce(
		(best, count, hour) => (count > hourCounts[best] ? hour : best),
		0,
	);

	return (
		<div
			className={className}
			role="img"
			aria-label={`Hourly activity for ${comName}, busiest at ${hourLabel(peakHour)}`}
		>
			<div className="flex h-9 items-end gap-px">
				{HOURS.map((hour) => {
					const count = hourCounts[hour] ?? 0;
					const isZero = count === 0;
					const percent = isZero
						? 0
						: Math.max((count / max) * 100, MIN_BAR_PERCENT);
					return (
						<div
							key={`bar-${hour}`}
							data-hour-bar=""
							title={`${hourLabel(hour)} — ${count.toLocaleString()} ${plural(count, "detection")}`}
							className="flex-1 rounded-t-[1px]"
							style={
								isZero
									? { height: "2px", backgroundColor: "var(--line)" }
									: {
											height: `${percent}%`,
											backgroundColor: heatColorAt(count / max),
										}
							}
						/>
					);
				})}
			</div>

			<HourBarTicks />
		</div>
	);
}

function HourBarTicks() {
	return (
		<div className="mt-1 flex">
			{HOURS.map((hour) => {
				const label = TICK_HOURS.includes(hour as (typeof TICK_HOURS)[number])
					? tickParts(hour)
					: null;
				return (
					<div
						key={`tick-${hour}`}
						className="flex flex-1 justify-center leading-none"
					>
						{label ? (
							<span
								data-hour-tick=""
								className="flex items-baseline gap-px text-muted-foreground"
							>
								<span className="text-[9px]">{label.number}</span>
								<span className="text-[7px]">{label.meridiem}</span>
							</span>
						) : null}
					</div>
				);
			})}
		</div>
	);
}

const SKELETON_BAR_HEIGHTS = [
	8, 8, 8, 8, 12, 40, 80, 100, 90, 70, 60, 55, 50, 45, 45, 50, 60, 70, 55, 30,
	12, 8, 8, 8,
];

export function SpeciesHourBarsSkeleton({
	className = "",
}: {
	className?: string;
}) {
	return (
		<div aria-hidden="true" className={className}>
			<div className="flex h-9 items-end gap-px">
				{SKELETON_BAR_HEIGHTS.map((percent, hour) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: one bar per hour
						key={hour}
						className="flex-1 animate-pulse rounded-t-[1px] bg-muted"
						style={{ height: `${percent}%` }}
					/>
				))}
			</div>
			<HourBarTicks />
		</div>
	);
}

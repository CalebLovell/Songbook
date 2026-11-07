import type { TooltipContentProps } from "recharts";

import { plural } from "~/lib/number-format.ts";

export function ChartValueTooltip({
	active,
	label,
	payload,
	formatLabel,
}: TooltipContentProps & {
	formatLabel?: (label: unknown) => string;
}) {
	const raw = payload?.[0]?.value;
	const value = Number(raw);
	const shown = active && raw != null && !Number.isNaN(value);

	const bucket = formatLabel ? formatLabel(label) : String(label ?? "");
	return (
		<div
			aria-hidden
			className={
				shown
					? "block rounded-sm border border-line bg-paper-raised px-2 py-1 text-[13px] text-ink"
					: undefined
			}
		>
			{shown && (
				<>
					<span className="font-semibold">{bucket}</span>
					{` — ${value.toLocaleString()} ${plural(value, "detection")}`}
				</>
			)}
		</div>
	);
}

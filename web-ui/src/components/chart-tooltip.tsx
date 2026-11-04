import type { TooltipContentProps } from "recharts";

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
	const noun = value === 1 ? "detection" : "detections";

	return (
		<div
			aria-hidden
			className={
				shown
					? "block rounded-sm border border-[var(--line)] bg-[var(--paper-raised)] px-2 py-1 text-[13px] text-[var(--ink)]"
					: undefined
			}
		>
			{shown && (
				<>
					<span className="font-semibold">{bucket}</span>
					{` — ${value.toLocaleString()} ${noun}`}
				</>
			)}
		</div>
	);
}

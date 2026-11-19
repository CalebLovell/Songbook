import { Count } from "~/components/ui/count.tsx";
import { ShellFigure } from "~/components/ui/shell.tsx";

function Dot() {
	return (
		<span
			className="size-0.75 shrink-0 rounded-full bg-muted-foreground opacity-60"
			aria-hidden="true"
		/>
	);
}

export function WindowSummary({
	rows,
	label,
}: {
	rows: readonly { totalDetections: number }[] | null;
	label?: string;
}) {
	const detections = rows?.reduce((sum, row) => sum + row.totalDetections, 0);

	return (
		<div className="flex min-w-0 items-center gap-2.5">
			<span className="h-4 w-px shrink-0 bg-line" aria-hidden="true" />
			<div className="flex translate-y-[-1.5px] items-center gap-2 truncate text-[13px] text-muted-foreground">
				{label ? (
					<>
						<span className="whitespace-nowrap">{label}</span>
						<Dot />
					</>
				) : null}
				<span className="whitespace-nowrap">
					{detections === undefined ? (
						<ShellFigure />
					) : (
						<Count>{detections.toLocaleString()}</Count>
					)}{" "}
					detections
				</span>
				<Dot />
				<span className="whitespace-nowrap">
					{rows ? (
						<Count>{rows.length.toLocaleString()}</Count>
					) : (
						<ShellFigure />
					)}{" "}
					species
				</span>
			</div>
		</div>
	);
}

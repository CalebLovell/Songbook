import { Pill } from "~/components/pill.tsx";
import {
	confidenceStyle,
	confidenceTooltip,
	formatConfidence,
} from "~/lib/confidence.ts";

export function ConfidencePill({
	confidence,
	average = false,
	className,
}: {
	confidence: number | null;
	average?: boolean;
	className?: string;
}) {
	if (confidence == null) return null;

	return (
		<Pill
			label={formatConfidence(confidence)}
			style={confidenceStyle(confidence)}
			tooltip={confidenceTooltip(confidence, { average })}
			tabular
			className={className}
		/>
	);
}

import type { CSSProperties, ReactNode } from "react";

import { GlyphChip } from "~/components/glyph-chip.tsx";
import { Hint } from "~/components/ui/hint.tsx";

export function Pill({
	icon: Icon,
	label,
	style,
	tooltip,
	tabular = false,
	iconOnly = false,
	className = "",
}: {
	icon?: React.ComponentType<{ className?: string }>;
	label: string;
	style: CSSProperties;
	tooltip?: ReactNode;
	tabular?: boolean;
	iconOnly?: boolean;
	className?: string;
}) {
	if (iconOnly && Icon) {
		return (
			<GlyphChip
				icon={Icon}
				label={label}
				style={style}
				tooltip={tooltip}
				size="sm"
				className={className}
			/>
		);
	}

	return (
		<Hint content={tooltip}>
			<span
				className={`inline-flex h-[26px] shrink-0 items-center gap-1 rounded-full px-2.5 font-semibold text-[13px] leading-none sm:text-xs ${tabular ? "tabular-data" : ""} ${className}`}
				style={style}
			>
				{Icon ? <Icon className="size-3" aria-hidden="true" /> : null}
				{label}
			</span>
		</Hint>
	);
}

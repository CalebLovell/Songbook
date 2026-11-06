import type { CSSProperties, ReactNode } from "react";

import { Hint } from "~/components/ui/hint.tsx";

export const GLYPH_CHIP_SIZE = "size-6.5";

const SIZES = {
	default: { chip: GLYPH_CHIP_SIZE, glyph: "size-3.5" },
	sm: { chip: "size-5", glyph: "size-3" },
};

export function GlyphChip({
	icon: Icon,
	label,
	style,
	tooltip,
	tooltipClassName,
	interactive = false,
	size = "default",
	className = "",
}: {
	icon: React.ComponentType<{ className?: string }>;
	label?: string;
	style?: CSSProperties;
	tooltip?: ReactNode;
	tooltipClassName?: string;
	interactive?: boolean;
	size?: keyof typeof SIZES;
	className?: string;
}) {
	const chipClass = `inline-grid ${SIZES[size].chip} shrink-0 place-items-center rounded-full bg-icon-well text-muted-foreground ${className}`;
	const glyph = <Icon className={SIZES[size].glyph} aria-hidden="true" />;

	return (
		<Hint content={tooltip} className={tooltipClassName}>
			{interactive ? (
				<button
					type="button"
					aria-label={label}
					className={`${chipClass} cursor-help`}
					style={style}
				>
					{glyph}
				</button>
			) : (
				<span
					className={chipClass}
					style={style}
					aria-hidden={label ? undefined : true}
				>
					{glyph}
					{label ? <span className="sr-only">{label}</span> : null}
				</span>
			)}
		</Hint>
	);
}

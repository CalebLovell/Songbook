import { createLink } from "@tanstack/react-router";
import type * as React from "react";

import { Button } from "~/components/ui/button.tsx";

type ButtonAnchorProps = React.ComponentProps<"a"> &
	Pick<
		React.ComponentProps<typeof Button>,
		"variant" | "size" | "icon" | "iconPosition"
	>;

function ButtonAnchor({
	variant,
	size,
	icon,
	iconPosition,
	className,
	...props
}: ButtonAnchorProps) {
	return (
		<Button
			asChild
			variant={variant}
			size={size}
			icon={icon}
			iconPosition={iconPosition}
			className={className}
		>
			<a {...props} />
		</Button>
	);
}

export const ButtonLink = createLink(ButtonAnchor);

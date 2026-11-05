import type { ComponentProps, ElementType } from "react";

import { cn } from "~/lib/utils.ts";

type KickerProps<T extends ElementType> = { as?: T } & ComponentProps<T>;

export function Kicker<T extends ElementType = "div">(props: KickerProps<T>) {
	const { as, className, ...rest } = props as KickerProps<"div">;
	const Tag: ElementType = as ?? "div";
	return (
		<Tag
			{...rest}
			className={cn(
				"font-bold text-[0.69rem] text-kicker uppercase tracking-[0.16em]",
				className,
			)}
		/>
	);
}

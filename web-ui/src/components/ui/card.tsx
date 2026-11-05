import type { ComponentProps, ElementType } from "react";

import { cn } from "~/lib/utils.ts";

export const CARD_CLASS =
	"rounded-md border bg-[linear-gradient(165deg,var(--surface-strong),var(--surface))] p-page transition-[background-color,color,border-color,transform] duration-180 ease-[ease]";

type CardProps<T extends ElementType> = { as?: T } & ComponentProps<T>;

export function Card<T extends ElementType = "div">(props: CardProps<T>) {
	const { as, className, ...rest } = props as CardProps<"div">;
	const Tag: ElementType = as ?? "div";
	return <Tag {...rest} className={cn(CARD_CLASS, className)} />;
}

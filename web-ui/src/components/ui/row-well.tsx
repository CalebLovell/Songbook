import type { ComponentProps, ElementType } from "react";

import { cn } from "~/lib/utils.ts";

type RowWellProps<T extends ElementType> = { as: T } & ComponentProps<T>;

export function RowWell<T extends ElementType>(props: RowWellProps<T>) {
	const {
		as: Tag,
		className,
		...rest
	} = props as unknown as RowWellProps<"div">;
	return (
		<Tag
			{...rest}
			className={cn(
				"overflow-clip bg-row-well [:where(&>*)]:bg-card [:where(&>:last-child)]:[box-shadow:0_1px_0_var(--line)]",
				className,
			)}
		/>
	);
}

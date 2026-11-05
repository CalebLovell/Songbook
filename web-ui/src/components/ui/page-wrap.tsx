import type { ComponentProps } from "react";

import { cn } from "~/lib/utils.ts";

export function PageWrap({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			{...props}
			className={cn("w-full py-page pr-page-end pl-page", className)}
		/>
	);
}

import type { ReactNode } from "react";

export function EmptyNote({ children }: { children: ReactNode }) {
	return <p className="mt-page text-muted-foreground text-sm">{children}</p>;
}

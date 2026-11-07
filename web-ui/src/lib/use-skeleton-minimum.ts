import { useEffect, useState } from "react";

import { useClientValue } from "~/lib/use-client-value.ts";

const MINIMUM_SKELETON_MS = 200;

export function useSkeletonMinimum<T>(data: T | undefined): T | undefined {
	const isClientMount = useClientValue(() => true, false);
	const [phase, setPhase] = useState<"content" | "holding" | "waiting">(() => {
		if (data !== undefined) return "content";
		return isClientMount ? "holding" : "waiting";
	});
	if (data === undefined && phase === "content") setPhase("holding");
	if (data !== undefined && phase === "waiting") setPhase("content");

	useEffect(() => {
		if (phase !== "holding") return;
		const timer = setTimeout(() => setPhase("waiting"), MINIMUM_SKELETON_MS);
		return () => clearTimeout(timer);
	}, [phase]);

	return phase === "content" ? data : undefined;
}

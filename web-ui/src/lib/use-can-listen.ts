import { useRouteContext } from "@tanstack/react-router";

export function useCanListen(): boolean {
	return useRouteContext({ from: "__root__" }).auth.unlocked;
}

import { useQuery } from "@tanstack/react-query";
import { updateStateQuery } from "./updates.ts";
import { availableUpdate } from "./updates-data.ts";

const INTERVAL_MS = 60_000;

export function useUpdateOffered(enabled: boolean): string | null {
	const { data: offered } = useQuery({
		...updateStateQuery,
		enabled,
		refetchInterval: INTERVAL_MS,
		select: (state) => (state.managed ? availableUpdate(state) : null),
	});
	return enabled ? (offered ?? null) : null;
}

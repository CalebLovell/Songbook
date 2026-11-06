import { useQuery } from "@tanstack/react-query";

import { stationHealthQuery } from "./health.ts";
import { settingsMarkLabel } from "./health-data.ts";
import { useUpdateOffered } from "./use-update-offered.ts";

const INTERVAL_MS = 60_000;

export function useSettingsMark(enabled: boolean): string | null {
	const offered = useUpdateOffered(enabled);
	const { data: toDoCount } = useQuery({
		...stationHealthQuery,
		enabled,
		refetchInterval: INTERVAL_MS,
		select: (health) => health.toDos.length,
	});
	return enabled ? settingsMarkLabel(toDoCount ?? 0, offered) : null;
}

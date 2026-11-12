import { useEffect } from "react";

import { APP_VERSION } from "./app-version.ts";
import { reloadForRelease } from "./release.ts";
import { installedNewerBuild, type UpdateState } from "./updates-data.ts";

export function useReloadOnUpdate(state: UpdateState | null | undefined) {
	const target = state ? installedNewerBuild(state, APP_VERSION) : null;
	useEffect(() => {
		if (target) reloadForRelease(target);
	}, [target]);
}

import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { publicOrigin } from "~/lib/csrf-origin.ts";

export const stationOrigin = createIsomorphicFn()
	.server(() =>
		publicOrigin(getRequest(), Boolean(process.env.WEB_UI_TRUSTED_PROXY)),
	)
	.client(() => window.location.origin);

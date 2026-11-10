import { createServerFn } from "@tanstack/react-start";
import { requireUnlocked } from "./auth.ts";
import {
	loadSpeciesFilterPage,
	saveSpeciesFilterLists,
} from "./species-filter.server.ts";
import { speciesFilterSaveSchema } from "./species-filter-data.ts";

export const getSpeciesFilterPage = createServerFn({ method: "GET" })
	.middleware([requireUnlocked])
	.handler(() => loadSpeciesFilterPage());

export const saveSpeciesFilter = createServerFn({ method: "POST" })
	.middleware([requireUnlocked])
	.validator(speciesFilterSaveSchema)
	.handler(({ data }) => saveSpeciesFilterLists(data));

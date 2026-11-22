import { db } from "~/db/index.ts";
import { detections } from "~/db/schema.ts";
import { speciesFuse } from "~/lib/species-fuse.ts";

async function fuzzySpeciesNames(query: string): Promise<string[]> {
	const names = await db
		.selectDistinct({
			comName: detections.Com_Name,
			sciName: detections.Sci_Name,
		})
		.from(detections);
	return speciesFuse(names)
		.search(query)
		.map((result) => result.item.comName);
}

function confidencePercent(query: string): number | null {
	const match = /^(\d{1,3})\s*%?$/.exec(query.trim());
	if (!match) return null;
	const percent = Number(match[1]);
	return percent >= 0 && percent <= 100 ? percent : null;
}

export type DetectionSearchMatch = {
	comNames: string[];
	percent: number | null;
};

export async function detectionSearchMatch(
	text: string,
): Promise<DetectionSearchMatch> {
	return {
		comNames: await fuzzySpeciesNames(text),
		percent: confidencePercent(text),
	};
}

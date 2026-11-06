import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { __unstable__loadDesignSystem } from "@tailwindcss/node";

const SOURCE_ROOT = "src";
const STYLESHEET = join(SOURCE_ROOT, "styles.css");
const ROOT_FONT_SIZE_PX = 16;
const SKIPPED_FILES = new Set(["routeTree.gen.ts", "reference-photos.ts"]);
const TOKEN = /[^\s"'`]+/g;

function sourceFiles(): string[] {
	return readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
		.filter((path) => /\.tsx?$/.test(path))
		.filter((path) => !SKIPPED_FILES.has(path.split(/[\\/]/).pop() ?? ""))
		.map((path) => join(SOURCE_ROOT, path));
}

async function canonicalForms(
	tokens: Set<string>,
): Promise<Map<string, string>> {
	const designSystem = await __unstable__loadDesignSystem(
		readFileSync(STYLESHEET, "utf8"),
		{ base: resolve(SOURCE_ROOT) },
	);

	const replacements = new Map<string, string>();
	for (const token of tokens) {
		const [canonical] = designSystem.canonicalizeCandidates([token], {
			rem: ROOT_FONT_SIZE_PX,
			logicalToPhysical: true,
		});
		if (canonical && canonical !== token) replacements.set(token, canonical);
	}
	return replacements;
}

const sources = new Map(
	sourceFiles().map((path) => [path, readFileSync(path, "utf8")]),
);

const tokens = new Set<string>();
for (const source of sources.values()) {
	for (const [token] of source.matchAll(TOKEN)) {
		if (!token.includes("${")) tokens.add(token);
	}
}

const replacements = await canonicalForms(tokens);

let changedFiles = 0;
for (const [path, source] of sources) {
	const rewritten = source.replace(
		TOKEN,
		(token) => replacements.get(token) ?? token,
	);
	if (rewritten === source) continue;
	writeFileSync(path, rewritten);
	changedFiles += 1;
	console.log(path);
}

for (const [from, to] of replacements) console.log(`  ${from} -> ${to}`);
console.log(`Canonicalized classes in ${changedFiles} file(s).`);

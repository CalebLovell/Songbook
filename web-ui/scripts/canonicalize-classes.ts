import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_ROOT = "src";
const SKIPPED_FILES = new Set(["routeTree.gen.ts", "reference-photos.ts"]);
const TOKEN = /[^\s"'`]+/g;

function sourceFiles(): string[] {
	return readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
		.filter((path) => /\.tsx?$/.test(path))
		.filter((path) => !SKIPPED_FILES.has(path.split(/[\\/]/).pop() ?? ""))
		.map((path) => join(SOURCE_ROOT, path));
}

function canonicalForms(tokens: Set<string>): Map<string, string> {
	const result = spawnSync(
		"npx tailwindcss canonicalize --stream --css src/styles.css --format jsonl",
		{
			input: [...tokens].join("\n"),
			encoding: "utf8",
			shell: true,
			maxBuffer: 256 * 1024 * 1024,
		},
	);
	if (result.status !== 0) {
		throw new Error(`tailwindcss canonicalize failed:\n${result.stderr}`);
	}

	const replacements = new Map<string, string>();
	for (const line of result.stdout.split("\n")) {
		if (!line.trim()) continue;
		const { input, output, changed } = JSON.parse(line);
		if (changed) replacements.set(input, output);
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

const replacements = canonicalForms(tokens);

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

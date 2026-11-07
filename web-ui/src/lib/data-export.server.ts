import "@tanstack/react-start/server-only";

import { DatabaseSync } from "node:sqlite";

import type { DetectionExportQuery } from "./data-backup-format.ts";

const COLUMNS = [
	"Date",
	"Time",
	"Sci_Name",
	"Com_Name",
	"Confidence",
	"Lat",
	"Lon",
	"Cutoff",
	"Week",
	"Sens",
	"Overlap",
	"File_Name",
] as const;

const BATCH_ROWS = 2000;

type ExportRow = Record<(typeof COLUMNS)[number], unknown> & {
	row_id: number;
};

function csvField(value: unknown): string {
	if (value === null || value === undefined) return "";
	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvLine(values: readonly unknown[]): string {
	return `${values.map(csvField).join(",")}\r\n`;
}

export async function* detectionCsvChunks(
	databasePath: string,
	query: DetectionExportQuery,
): AsyncGenerator<string> {
	const filters: string[] = [];
	const filterValues: string[] = [];
	if (query.from) {
		filters.push("Date >= ?");
		filterValues.push(query.from);
	}
	if (query.to) {
		filters.push("Date <= ?");
		filterValues.push(query.to);
	}
	if (query.species) {
		filters.push("Sci_Name = ?");
		filterValues.push(query.species);
	}
	const select = `SELECT rowid AS row_id, ${COLUMNS.join(", ")} FROM detections`;
	const order = `ORDER BY Date, Time, rowid LIMIT ${BATCH_ROWS}`;
	const where = (clauses: string[]) =>
		clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

	yield csvLine(COLUMNS);
	const database = new DatabaseSync(databasePath, { readOnly: true });
	try {
		const first = database.prepare(`${select} ${where(filters)} ${order}`);
		const next = database.prepare(
			`${select} ${where([...filters, "(Date, Time, rowid) > (?, ?, ?)"])} ${order}`,
		);
		let rows = first.all(...filterValues) as ExportRow[];
		while (rows.length > 0) {
			yield rows
				.map((row) => csvLine(COLUMNS.map((column) => row[column])))
				.join("");
			if (rows.length < BATCH_ROWS) return;
			const last = rows[rows.length - 1];
			rows = next.all(
				...filterValues,
				last.Date as string,
				last.Time as string,
				last.row_id,
			) as ExportRow[];
		}
	} finally {
		database.close();
	}
}

export function detectionCsvFileName(query: DetectionExportQuery): string {
	const range = [query.from, query.to].filter(Boolean).join("-to-");
	return `songbook-detections${range ? `-${range}` : ""}.csv`;
}

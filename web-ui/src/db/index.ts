import "@tanstack/react-start/server-only";

import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";

import * as schema from "./schema.ts";

const dbPath = process.env.BIRDNET_DB_PATH ?? "../scripts/birds.db";

const CREATE_DETECTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS detections (
  Date DATE,
  Time TIME,
  Sci_Name VARCHAR(100) NOT NULL,
  Com_Name VARCHAR(100) NOT NULL,
  Confidence FLOAT,
  Lat FLOAT,
  Lon FLOAT,
  Cutoff FLOAT,
  Week INT,
  Sens FLOAT,
  Overlap FLOAT,
  File_Name VARCHAR(100) NOT NULL
);
CREATE INDEX IF NOT EXISTS "detections_Com_Name" ON "detections" ("Com_Name");
CREATE INDEX IF NOT EXISTS "detections_Sci_Name" ON "detections" ("Sci_Name");
CREATE INDEX IF NOT EXISTS "detections_Date_Time" ON "detections" ("Date" DESC, "Time" DESC);
`;

function openDetectionsDb(): DatabaseSync {
	try {
		return new DatabaseSync(dbPath, { readOnly: true });
	} catch {
		const fallback = new DatabaseSync(dbPath, { readOnly: false });
		fallback.exec(CREATE_DETECTIONS_TABLE);
		return fallback;
	}
}

export function openWritableDetectionsDb(): DatabaseSync {
	return new DatabaseSync(dbPath, { readOnly: false });
}

export const sqlite = openDetectionsDb();

export function dataVersion(): number {
	const row = sqlite.prepare("PRAGMA data_version").get() as {
		data_version: number;
	};
	return row.data_version;
}

export const db = drizzle(
	async (sql, params, method) => {
		const stmt = sqlite.prepare(sql);
		if (method === "run") {
			stmt.run(...params);
			return { rows: [] };
		}
		if (method === "get") {
			const row = stmt.get(...params) as Record<string, unknown> | undefined;
			return { rows: row ? [Object.values(row)] : [] };
		}
		const rows = stmt.all(...params) as Record<string, unknown>[];
		return { rows: rows.map((row) => Object.values(row)) };
	},
	{ schema },
);

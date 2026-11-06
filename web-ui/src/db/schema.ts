import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const detections = sqliteTable("detections", {
	Date: text("Date").notNull(),
	Time: text("Time").notNull(),
	Sci_Name: text("Sci_Name").notNull(),
	Com_Name: text("Com_Name").notNull(),
	Confidence: real("Confidence"),
	Lat: real("Lat"),
	Lon: real("Lon"),
	Cutoff: real("Cutoff"),
	Week: integer("Week"),
	Sens: real("Sens"),
	Overlap: real("Overlap"),
	File_Name: text("File_Name").notNull(),
});

export type Detection = typeof detections.$inferSelect;

export const reviews = sqliteTable("reviews", {
	Date: text("Date").notNull(),
	Time: text("Time").notNull(),
	Com_Name: text("Com_Name").notNull(),
	File_Name: text("File_Name").notNull(),
	action: text("action").notNull(),
	confidence: real("confidence"),
	reviewed_at: text("reviewed_at").notNull(),
});

import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const schedules = pgTable("schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  enabled: boolean("enabled").default(false),
  frequency: varchar("frequency", { enum: ['daily', 'weekly', 'monthly'] }).notNull(),
  time: text("time").notNull(), // HH:MM format
  dayOfWeek: integer("day_of_week"), // 0-6, Sunday=0
  dayOfMonth: integer("day_of_month"), // 1-31
  preferences: text("preferences").notNull(),
  lastRun: timestamp("last_run"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const generatedPlaylists = pgTable("generated_playlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  scheduleId: varchar("schedule_id"),
  spotifyPlaylistId: text("spotify_playlist_id"),
  name: text("name").notNull(),
  description: text("description"),
  trackCount: integer("track_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertScheduleSchema = createInsertSchema(schedules).omit({
  id: true,
  lastRun: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGeneratedPlaylistSchema = createInsertSchema(generatedPlaylists).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type GeneratedPlaylist = typeof generatedPlaylists.$inferSelect;
export type InsertGeneratedPlaylist = z.infer<typeof insertGeneratedPlaylistSchema>;
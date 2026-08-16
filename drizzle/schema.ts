import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  color: varchar("color", { length: 16 }).notNull().default("#A87955"),
  tone: varchar("tone", { length: 160 }).notNull().default("Quiet confidence"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ideas = mysqlTable("ideas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  brandId: int("brandId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  originalText: text("originalText").notNull(),
  description: text("description"),
  tags: text("tags").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ideaVersions = mysqlTable("ideaVersions", {
  id: int("id").autoincrement().primaryKey(),
  ideaId: int("ideaId").notNull(),
  versionNumber: int("versionNumber").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  changeSummary: varchar("changeSummary", { length: 280 }).notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const radarReports = mysqlTable("radarReports", {
  id: int("id").autoincrement().primaryKey(),
  ideaId: int("ideaId").notNull(),
  userId: int("userId").notNull(),
  resultJson: text("resultJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const creativeAssets = mysqlTable("creativeAssets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  brandId: int("brandId").notNull(),
  ideaId: int("ideaId"),
  name: varchar("name", { length: 180 }).notNull(),
  assetType: mysqlEnum("assetType", ["font", "format", "license"]).notNull(),
  status: varchar("status", { length: 40 }).notNull().default("ready"),
  storageKey: varchar("storageKey", { length: 512 }),
  storageUrl: varchar("storageUrl", { length: 512 }),
  metadata: text("metadata").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

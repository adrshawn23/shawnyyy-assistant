import { pgTable, serial, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
});

export const workbooks = pgTable("workbooks", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  workbookId: serial("workbook_id").references(() => workbooks.id),
  requesterId: serial("requester_id").references(() => users.id),
  reason: text("reason"),
  status: text("status").default("pending"), // pending, verified, revoked
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  workbookId: serial("workbook_id").references(() => workbooks.id),
  command: text("command").notNull(),
  status: text("status").default("pending"),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  workbookId: serial("workbook_id").references(() => workbooks.id),
  type: text("type").notNull(), // mapping, cleaning, kpi
  definition: jsonb("definition").notNull(),
  version: serial("version").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

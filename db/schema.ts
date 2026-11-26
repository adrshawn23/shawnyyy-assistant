import {
  pgTable, serial, text, timestamp, jsonb, boolean, integer,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const workbooks = pgTable("workbooks", {
  id: serial("id").primaryKey(),
  spreadsheetId: text("spreadsheet_id").unique(),
  url: text("url").notNull(),
  name: text("name"),
  ownerEmail: text("owner_email"),
  isDemo: boolean("is_demo").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  workbookId: integer("workbook_id").references(() => workbooks.id),
  requesterEmail: text("requester_email"),
  ownerEmail: text("owner_email"),
  reason: text("reason"),
  // source workbooks: viewer; reporting workbooks: editor
  requestedRole: text("requested_role").default("viewer"),
  status: text("status").default("pending"), // pending | verified | revoked
  draftText: text("draft_text"),
  verification: jsonb("verification"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: serial("id").primaryKey(),
  accessRequestId: integer("access_request_id").references(() => accessRequests.id),
  workbookId: integer("workbook_id").references(() => workbooks.id),
  kind: text("kind").notNull(), // viewer | editor | read
  result: text("result").notNull(), // success | denied | error
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  workbookId: integer("workbook_id").references(() => workbooks.id),
  reportingWorkbookId: integer("reporting_workbook_id").references(() => workbooks.id),
  type: text("type").notNull(), // clean_sheet | hub_report | latest_match | job_status | formula | workflow
  command: text("command").notNull(),
  status: text("status").default("pending"), // pending | needs_input | paused | completed | failed
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  idempotencyKey: text("idempotency_key"),
  result: jsonb("result"),
  reconciliation: jsonb("reconciliation"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  workbookId: integer("workbook_id").references(() => workbooks.id), // null = global default
  scopeWorkbookIds: jsonb("scope_workbook_ids"), // number[] | "selected"
  type: text("type").notNull(), // mapping | cleaning | kpi | formula | workflow
  name: text("name"),
  definition: jsonb("definition").notNull(),
  version: integer("version").default(1).notNull(),
  status: text("status").default("active"), // active | disabled | pending | rejected
  supersedesId: integer("supersedes_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const corrections = pgTable("corrections", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => jobs.id),
  workbookId: integer("workbook_id").references(() => workbooks.id),
  kind: text("kind").notNull(), // formula | mapping | cleaning | kpi
  previous: jsonb("previous"),
  proposed: jsonb("proposed"),
  status: text("status").default("pending"), // pending | used_once | approved_workbook | approved_global | rejected
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  workbookId: integer("workbook_id").references(() => workbooks.id),
  scopeWorkbookIds: jsonb("scope_workbook_ids"),
  definition: jsonb("definition").notNull(), // steps, mappings, formulas, kpis, checks, destination
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Persistent chat memory: every user command and Shawn reply is stored so
// conversations can be recalled and mined for learnings.
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  email: text("email"),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  kind: text("kind"), // command type or "chat"
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Stored OAuth tokens for the connected Google account (Drive/Sheets access).
export const oauthTokens = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("google"),
  email: text("email"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

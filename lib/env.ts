// Central environment access. DEMO_MODE=true lets Shawn run with no Google
// credentials and no real workbooks — it uses built-in sample data instead.
const serviceAccountJson =
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";

export const env = {
  demoMode: process.env.DEMO_MODE === "true" || !serviceAccountJson,
  serviceAccountJson,
  databaseUrl: process.env.DATABASE_URL || "",
  authSecret: process.env.AUTH_SECRET || "dev-secret-change-me",
  // Company sign-in: single shared company credential for the internal tool.
  loginEmail: process.env.SHAWN_LOGIN_EMAIL || "",
  loginPassword: process.env.SHAWN_LOGIN_PASSWORD || "",
  companyDomain: process.env.COMPANY_DOMAIN || "",
  // Service account identity shown to owners in access-request drafts.
  serviceAccountEmail:
    process.env.SHAWN_SERVICE_ACCOUNT_EMAIL ||
    "shawn-assistant@your-project.iam.gserviceaccount.com",
  // Optional AI provider for command interpretation. Deterministic parser is
  // always used for execution; AI only proposes intent/parameters.
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  // Authorized sender for access-request emails (optional; copy-paste fallback).
  emailSender: process.env.EMAIL_SENDER || "",
};

export function isDemo(): boolean {
  return env.demoMode;
}

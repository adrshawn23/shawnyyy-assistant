// Conversational layer: detects chat-style messages (greetings, help, thanks,
// identity questions) and produces natural-language replies. Works in English
// and Bisaya. Returns null when the message is a real command.

const HELP = `Here's what I can do:

• "clean this raw data and build this week's hub report" — clean a Sheet and publish the report
• "clean sheet" — clean only, no publishing (shows flagged rows)
• "build dashboard" / "show KPIs" — hub report + dashboard summary
• "find latest matching entry by date" — paste-ready formula for the newest match
• "show job status" — check on running/finished jobs
• "Shawn, remember this process" — save the last workflow
• "same as last time" — rerun the saved workflow
• "use X instead of Y" — record a correction for review

You can also paste a Sheet URL, or just talk to me — "kumusta", "unsay ang kaya nimo?", "salamat" all work.`;

export function converse(text: string): string | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  // Greetings (short messages only, so "hi, clean the sheet" still parses as a command)
  if (t.length < 40 && /^(hi+|hello+|hey+|yo|kumusta|maayong (buntag|hapon|gabii)|good (morning|afternoon|evening)|howdy|hola)\b/.test(t)) {
    return "Hi! I'm Shawn, your sheets assistant. Give me a command like \"clean this raw data and build this week's hub report\", or ask me what I can do.";
  }

  if (/\b(help|what can you do|what do you do|commands?|unsay ang kaya|ano ang kaya|unsay ang buhaton)\b/.test(t)) {
    return HELP;
  }

  if (/\b(thanks|thank you|salamat|daghan|salamat kaayo)\b/.test(t) && t.length < 60) {
    return "You're welcome! Anything else?";
  }

  if (/\b(who are you|what are you|unsay ka|unsay ang ngalan nimo|your name)\b/.test(t)) {
    return "I'm Shawn — an assistant that cleans spreadsheets, builds hub reports, checks KPIs, and remembers your workflows. I work in English and Bisaya.";
  }

  if (/\b(how are you|kumusta ka|kumusta man|how's it going)\b/.test(t) && t.length < 50) {
    return "Running smooth! Ready when you are — what sheet are we working on?";
  }

  if (/\b(bye|goodbye|paalam|see you|good night)\b/.test(t) && t.length < 40) {
    return "Paalam! I'll be here when you need me.";
  }

  return null;
}

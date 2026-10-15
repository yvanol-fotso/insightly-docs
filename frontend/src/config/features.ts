/** Feature flags: flip these on once the matching backend route exists. */
export const FEATURES = {
  /** Rename / delete conversations (needs PATCH + DELETE /sessions/:id). */
  manageConversations: false,
} as const;

/** Where the "Contact sales" button sends people. Set VITE_SALES_EMAIL in .env. */
export const SALES_EMAIL: string = import.meta.env.VITE_SALES_EMAIL ?? "";

/** Hold and deny reasons. Stored in English, so the admin console reads the same words whatever the guard's language.
 *  Index + 1 = the i18n key fh.why.N. */
export const WHY_EN = ["Name not found", "Photo doesn't match", "No photo, details don't match", "Outside visiting hours", "Something else"] as const;
/** Deny offers the hold reasons except "Name not found": a person with a record was found (owner, 2026-10-08). */
export const DENY_WHY = [2, 3, 4, 5] as const;
export const OTHER = 5;

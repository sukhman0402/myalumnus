// The admin console's words for each database error hint (migration 0011). [message, field it belongs to]
const MSG: Record<string, [string, string?]> = {
  not_allowed: ["Only admins can do this. Sign in again if your access just changed."],
  not_found: ["This record no longer exists. Go back to the list and refresh."],
  name_required: ["Enter the full name.", "name"],
  kind_invalid: ["Pick a type from the list.", "kind"],
  batch_invalid: ["Enter a 4-digit year between 1950 and 2100, e.g. 2019.", "batch"],
  batch_required: ["Alumni need a batch (graduation year), e.g. 2019.", "batch"],
  roll_required: ["Current students need a roll number: the gate finds them by it.", "roll"],
  roll_taken: ["Another record already has this roll number. Search for it in People.", "roll"],
  row_invalid: ["A row is incomplete."],
  too_many: ["Too many rows in one go. Upload at most 5,000."],
  path_invalid: ["The photo couldn't be saved. Try again."],
  host_required: ["Enter who they are visiting: the guard calls this person if needed.", "host"],
  date_past: ["Pick today or a later date.", "date"],
  email_required: ["Enter an email address: this account signs in with a code sent there.", "email"],
  email_taken: ["Another account already uses this email.", "email"],
  email_locked: ["This account has signed in, so its email can't change. Deactivate it and add a new one instead.", "email"],
  gate_required: ["Pick a gate.", "gate"],
  role_locked: ["The role can't change. Deactivate this account and add a new one instead."],
  self_lock: ["You can't deactivate your own account. Ask another admin."],
  hours_invalid: ["Visiting hours must start before they end, on the same day.", "close"],
  minutes_invalid: ["Enter a whole number of minutes from 1 to 60.", "minutes"],
  demo_locked: ["This demo account can't be changed or deactivated."],
  demo_photo: ["Photos can't be changed in the demo."],
  outside_hours: ["That time is outside visiting hours. Pick a time within them.", "time"],   // was the generic "check the connection"
  phone_invalid: ["Check the number: digits, spaces, brackets, - and + only.", "phone"],
};

export const GENERIC = "Couldn't save. Check the connection and try again. Nothing was changed.";

/** { error, fields } for a form state, from a Supabase error. Unknown errors get the generic message. */
export function fromHint(error: { hint?: string | null; message?: string } | null): { error?: string; fields?: Record<string, string> } {
  const m = error?.hint ? MSG[error.hint] : undefined;
  if (!m) return { error: GENERIC };
  const [text, field] = m;
  return field ? { fields: { [field]: text } } : { error: text };
}

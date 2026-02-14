## 2026-02-16 - AI Message Spoofing in Shared Study Sessions

**Vulnerability:** Authenticated users were able to spoof AI-generated messages by manually setting the `is_ai_message` boolean flag to `true` during client-side insertion into the `session_messages` table.

**Learning:** Trusting the client to set security-critical metadata (like identity flags) in a shared environment is a major risk. Even if the user is authorized to insert into a table, they should not be authorized to set fields that define the "trusted" identity of the message sender.

**Prevention:** Use Row Level Security (RLS) to restrict sensitive columns from being set by authenticated users (`is_ai_message = false` in `WITH CHECK` clause). Offload the creation of trusted content to server-side components (like Edge Functions) that use elevated privileges (Service Role) to persist the data.

## 2026-02-16 - Mass Assignment in User Settings

**Vulnerability:** The `user_settings` table contained both user-editable fields (like `preferred_name`) and system-controlled fields (like `quiz_score_percentage`). The frontend was sending the entire settings state object in an `update` call, which allowed a malicious user to overwrite their quiz scores.

**Learning:** Spreading state objects directly into database update calls is a "Mass Assignment" vulnerability. It bypasses the intention of separate UI sections and allows any field in the table to be updated if the RLS policy is too broad.

**Prevention:** Always use explicit field mapping (allow-listing) in mutations that update database records. Only include fields that the specific UI component is intended to manage.

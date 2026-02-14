

# Knowledge Units (Credit System) - Complete Architecture Overhaul

## Overview
Replace the monthly subscription model with a pay-as-you-go "Knowledge Units" (KU) credit system. Users buy KU like airtime (₦50 per unit). Personal KU is used for 1-on-1 chats and exams. Group KU is separate, purchased by group admins, and shared across group members during sessions.

## Business Rules
- 1 Knowledge Unit = 1 prompt = ₦50
- New users get 3 free KU (one-time welcome bonus) + 1 chat limit
- Exam Mode requires at least 70 KU in personal wallet (the exam itself costs ~1 KU for generation, but the 70 minimum ensures the user is a committed paying customer)
- Personal KU: used for Gideon 1-on-1 chat and Exam Mode
- Group KU: separate wallet per study group, purchased by admin, deducted when any member sends a message in group sessions
- When group KU hits 0, no more messages can be sent in that group

## Pricing Packages (via Paystack)
| Package | KU | Price | Per-Unit |
|---------|-----|-------|----------|
| Starter | 10 | ₦500 | ₦50 |
| Standard | 25 | ₦1,250 | ₦50 |
| Bulk | 50 | ₦2,500 | ₦50 |
| Mega | 100 | ₦5,000 | ₦50 |

Group top-up uses the same packages but credits go to the group wallet.

---

## Technical Plan

### 1. Database Changes (Migration)

**New table: `ku_wallets`** (personal wallet)
- `id` uuid PK
- `user_id` uuid NOT NULL UNIQUE
- `balance` integer NOT NULL DEFAULT 3 (welcome bonus)
- `created_at`, `updated_at` timestamps

**New table: `group_wallets`** (group wallet)
- `id` uuid PK
- `group_id` uuid NOT NULL UNIQUE (references study_groups)
- `balance` integer NOT NULL DEFAULT 0
- `created_at`, `updated_at` timestamps

**New table: `ku_transactions`** (audit log)
- `id` uuid PK
- `user_id` uuid NOT NULL
- `group_id` uuid (NULL for personal)
- `amount` integer NOT NULL (positive = credit, negative = debit)
- `type` text NOT NULL ('purchase', 'chat_prompt', 'exam_start', 'group_prompt', 'welcome_bonus')
- `description` text
- `created_at` timestamp

**RLS policies:**
- Users can view their own wallet and transactions
- Users can view group wallets for groups they belong to
- Insert/update on wallets only via service role (edge functions)

**Drop/deprecate:** The `usage_tracking` table, `subscriptions` table logic will be phased out. Keep `subscriptions` and `payment_history` tables but stop relying on them for access control.

### 2. Edge Function: `purchase-ku` (new)
- Replaces `verify-payment` for KU purchases
- Accepts: `{ reference, package, target: 'personal' | 'group', groupId? }`
- Verifies Paystack payment
- Credits the correct wallet (personal or group)
- Logs transaction in `ku_transactions`
- Amount validation: package must match expected Paystack amount

### 3. Hook: Replace `useSubscription` with `useKnowledgeUnits`
- Fetches personal KU balance from `ku_wallets`
- Exposes: `balance`, `canChat` (balance > 0), `canStartExam` (balance >= 70), `deductKU()`, `refetch()`
- For group context: fetch group wallet balance

### 4. UI Changes

**Settings Page (Subscription Tab becomes "Wallet" Tab):**
- Show current KU balance prominently (like airtime balance)
- Show purchase packages as cards (Starter/Standard/Bulk/Mega)
- Purchase triggers Paystack inline checkout
- Transaction history list

**Dashboard:**
- Replace subscription checks with KU balance checks
- Show KU balance in header/dashboard
- "Low balance" warning when KU < 5

**Chat Page (`Chat.tsx`):**
- Before sending: check `balance > 0` instead of subscription plan
- After AI responds: call edge function to deduct 1 KU from personal wallet
- Show remaining KU in chat footer

**Exam Mode (`ExamMode.tsx`):**
- Gate: require `balance >= 70` instead of Pro/Premium plan
- Show message: "You need at least 70 Knowledge Units to start an exam"

**Study Session (`StudySession.tsx`):**
- Before sending: check group wallet balance > 0
- After AI responds: deduct 1 KU from group wallet
- Show group KU balance in session header
- When balance = 0: disable input, show "Group KU exhausted. Admin needs to top up."

**Community Page:**
- Group detail: show group wallet balance (visible to members)
- Admin: "Top Up Group KU" button

**SubscriptionPlans.tsx -> KUPurchase.tsx:**
- Complete rewrite to show KU packages instead of subscription tiers
- Toggle: "For Me" / "For My Group" with group selector

### 5. Edge Function Updates

**`xplane-chat`:** After streaming response, deduct 1 KU from user's personal wallet via service role client. Return error if balance is 0.

**`session-chat`:** After response, deduct 1 KU from the group wallet. Return error if group balance is 0.

**`generate-exam`:** Verify user has >= 70 KU before generating. Deduct 1 KU for the generation call.

### 6. Remove/Simplify
- Remove `UsageLimitBanner` (replace with simple "X KU remaining" display)
- Remove `SubscriptionGate` component (replace with KU balance checks)
- Remove `PLAN_LIMITS`, `PLAN_PRICES`, `PLAN_DISPLAY_PRICES` constants
- Remove daily chat limits and per-chat prompt limits logic
- Keep `payment_history` table for audit trail (repurpose for KU purchases)

### 7. Wallet Initialization
- Create `ku_wallets` row with `balance = 3` on user signup (via database trigger on `profiles` insert, or in the auth flow)
- Add a trigger: when a new row is inserted into `profiles`, insert a corresponding `ku_wallets` row with balance 3

### 8. Files to Create/Modify

| Action | File |
|--------|------|
| Create | `supabase/migrations/xxx_knowledge_units.sql` |
| Create | `supabase/functions/purchase-ku/index.ts` |
| Create | `src/hooks/useKnowledgeUnits.ts` |
| Create | `src/components/KUPurchase.tsx` |
| Create | `src/components/KUBalanceBadge.tsx` |
| Modify | `src/pages/Chat.tsx` (KU checks + deduction) |
| Modify | `src/pages/ExamMode.tsx` (70 KU gate) |
| Modify | `src/pages/StudySession.tsx` (group KU deduction) |
| Modify | `src/pages/Settings.tsx` (wallet tab) |
| Modify | `src/pages/Dashboard.tsx` (KU balance display) |
| Modify | `src/pages/Community.tsx` (group wallet top-up) |
| Modify | `supabase/functions/xplane-chat/index.ts` (deduct KU) |
| Modify | `supabase/functions/session-chat/index.ts` (deduct group KU) |
| Modify | `supabase/functions/generate-exam/index.ts` (check 70 KU) |
| Remove usage | `src/hooks/useSubscription.ts` (phase out) |
| Remove | `src/components/SubscriptionGate.tsx` |
| Remove | `src/components/UsageLimitBanner.tsx` |
| Remove | `src/components/SubscriptionPlans.tsx` |


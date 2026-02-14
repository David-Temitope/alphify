

# Library Space - Slot-Based Storage with KU Payment

## Overview
Users get 1 free library slot (max 10MB per file). Additional slots cost 5 KU each from their personal wallet. Deleting a file frees up the slot for reuse.

## Business Rules
- Every user starts with 1 free library slot
- Each file must be 10MB or less (already enforced)
- To upload beyond the free slot, user pays 5 KU per additional slot
- Slots are permanent once purchased (not per-file, per-slot)
- Deleting a file frees the slot -- the user can reuse it without paying again
- Slot count is stored on the wallet: `library_slots` column (default 1)

## Technical Details

### 1. Database Migration
Add a `library_slots` column to the existing `ku_wallets` table:
```text
ALTER TABLE ku_wallets ADD COLUMN library_slots integer NOT NULL DEFAULT 1;
```
Update existing rows to have 1 slot.

### 2. Update `useKnowledgeUnits` Hook
- Expose `librarySlots` from the wallet data
- Add a `buyLibrarySlot` function that:
  - Checks balance >= 5
  - Deducts 5 KU from wallet
  - Increments `library_slots` by 1
  - Logs a `ku_transactions` entry with type `library_slot`

### 3. Update `Library.tsx`
- Replace `useSubscription` import with `useKnowledgeUnits`
- Upload button logic: compare `files.length` against `librarySlots`
- If at capacity, show a prompt: "Buy another slot for 5 KU" instead of redirecting to settings
- Show slot usage in the header: e.g., "2/3 slots used"
- Add a "Buy More Space" button that calls `buyLibrarySlot`

### 4. Update `FileUpload.tsx`
- No major changes needed (10MB limit already enforced)
- Optionally pass slot availability as a prop so the modal can show a warning if no slots remain

### 5. Files to Modify
| Action | File |
|--------|------|
| Create | Migration SQL (add `library_slots` column) |
| Modify | `src/hooks/useKnowledgeUnits.ts` (add `librarySlots`, `buyLibrarySlot`) |
| Modify | `src/pages/Library.tsx` (replace subscription logic with KU slot logic) |


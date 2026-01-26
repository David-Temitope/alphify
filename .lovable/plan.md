
# Implementation Plan: Gideon AI Improvements & Fixes

This plan addresses 10 user requests plus 1 security concern across UI improvements, bug fixes, feature enhancements, and security hardening.

---

## Summary of Changes

| # | Issue | Status |
|---|-------|--------|
| 1 | Rename assistant to "Gideon" only (keep Xplane as app name) | To implement |
| 2 | Sticky header/input on Chat page | To implement |
| 3 | Exam samples in Settings page | To implement |
| 4 | Mobile-responsive Dashboard/Community pages | To implement |
| 5 | PDF lecture all pages | To implement |
| 6 | Study mate request bug | To fix |
| 7 | Calculation card design | To implement |
| 8 | Comprehensive exam after lectures | To implement |
| 9 | Wider chat input area | To implement |
| 10 | Star rating on Discover cards | To verify/fix |
| S1 | `user_settings` RLS security | Already fixed |

---

## Phase 1: Rename Assistant to "Gideon" (Keep App Name)

**Files to modify:**
- `src/pages/Auth.tsx` - Keep "Welcome to Xplane" and "Join Xplane"
- `src/pages/Chat.tsx` - Change all AI references to "Gideon"

**Changes in `src/pages/Chat.tsx`:**
1. Line 373-375: Keep sidebar logo as "Xp" / "Xplane"
2. Line 480-484: Change welcome message from "I'm Xplane" to "I'm Gideon"
3. Line 527: Change "Xplane is thinking..." to "Gideon is thinking..."
4. Line 481: Change logo from "Xp" to "G" in welcome state

---

## Phase 2: Sticky Header & Input on Chat Page

**Problem:** Users scroll infinitely to access the menu button and chat input.

**Solution:** Make header and input sticky while messages scroll independently.

**File:** `src/pages/Chat.tsx`

**Changes:**
1. Header (line 462): Already has correct structure, but ensure main container has proper flex layout
2. Wrap the messages area in a scrollable container while keeping header/input fixed
3. Update the main layout structure:

```text
<main className="flex-1 flex flex-col min-w-0 h-screen">
  <header className="sticky top-0 z-10 ...">  {/* Already sticky */}
  <div className="flex-1 overflow-y-auto ...">  {/* Messages scroll */}
  <div className="sticky bottom-0 ...">  {/* Input stays at bottom */}
```

The current structure already has `flex-1` on main and `flex-1 overflow-y-auto` on messages div (line 477). Need to ensure the input area (line 555) is sticky.

---

## Phase 3: Exam Question Samples in Settings

**New Feature:** Allow users to upload exam question samples for Gideon to follow.

**Database Changes:**
Add columns to `user_settings` table:
- `exam_sample_text TEXT` - Typed exam questions
- `exam_sample_file_id UUID` - Reference to uploaded file

**Files to modify:**
1. `src/pages/Settings.tsx` - Add new section for exam samples
2. Database migration for new columns

**UI Design:**
```text
## Exam Question Style (New Section)

Upload past exam papers or type sample questions so Gideon 
understands your professor's style.

[Text Area: Type sample exam questions...]

OR

[Upload Exam File Button]

{Uploaded file preview if exists}
```

**Study Session Integration:**
Update `supabase/functions/session-chat/index.ts` to:
1. Fetch `exam_sample_text` from all participants
2. Merge samples into the session context prompt
3. Use dominant style when generating quizzes/exams

---

## Phase 4: Mobile-Responsive Dashboard & Community Pages

### Dashboard (`src/pages/Dashboard.tsx`)

**Problem:** Settings and Sign Out buttons show full text, causing horizontal scroll on mobile.

**Solution:** On mobile, show only icons; on desktop, show text + icons.

**Changes (lines 81-112):**
```tsx
// Replace button content with responsive versions:
<Button variant="ghost" onClick={() => navigate('/library')}>
  <BookOpen className="h-4 w-4 md:mr-2" />
  <span className="hidden md:inline">Library</span>
</Button>
// Apply same pattern to Community, Settings, Sign Out buttons
```

### Community Page (`src/pages/Community.tsx`)

**Changes:**
1. Header back button: Icon only on mobile
2. Tab labels: Shorter text or icons on mobile
3. User cards: Stack vertically on small screens

**Pattern:**
```tsx
<Button variant="ghost" onClick={() => navigate('/dashboard')}>
  <ArrowLeft className="h-4 w-4 md:mr-2" />
  <span className="hidden md:inline">Back</span>
</Button>
```

---

## Phase 5: PDF Lecture All Pages

**Problem:** When users upload PDFs, Gideon only focuses on top pages.

**Solution:** Add a "Lecture This PDF" button that initiates page-by-page teaching.

**Files to modify:**
1. `src/pages/Chat.tsx` - Add lecture mode state and button
2. `src/components/FileUpload.tsx` - Improve PDF content extraction
3. `supabase/functions/xplane-chat/index.ts` - Add lecture mode instruction

**UI Flow:**
1. User uploads PDF → Shows file indicator with "📄 Document attached"
2. Add new button: "📚 Lecture This PDF" next to the file indicator
3. When clicked, send special message: `[LECTURE_MODE] Please lecture me through this entire document, page by page, covering every topic thoroughly.`

**Backend Changes:**
Add instruction to AI prompt when `[LECTURE_MODE]` is detected:
```text
## PDF Lecture Mode
The student wants a complete lecture on this document.
Go through EVERY section systematically:
1. Start with an overview of the document structure
2. Teach each section/chapter thoroughly
3. Use examples from their field of study
4. After covering all content, generate a comprehensive exam
```

---

## Phase 6: Fix Study Mate Request Bug

**Problem:** After accepting a request, users don't become study mates; they still appear in Discover with "Send Request" button.

**Root Cause Analysis:**
Looking at `src/pages/Community.tsx` lines 200-248, the `acceptRequest` mutation:
1. Updates request status to 'accepted' ✓
2. Creates study_mate connections (both directions) ✓
3. Deletes the request ✓
4. Invalidates queries ✓

The issue is in the RLS policy for `study_requests` table. Looking at line 251-264, the `rejectRequest` mutation uses `update` which requires UPDATE permission, but the RLS policy might not allow the recipient (`to_user_id`) to update.

**Fix Required:**
1. Check that `to_user_id` can UPDATE the request (RLS policy exists per schema)
2. After accepting, ensure request deletion succeeds
3. Add error handling for duplicate study_mates

**Database Fix:**
Add unique constraint to prevent duplicate study_mates:
```sql
ALTER TABLE study_mates ADD CONSTRAINT unique_mate_pair 
  UNIQUE (user_id, mate_id);
```

**Code Fix in `src/pages/Community.tsx`:**
```tsx
// In acceptRequest mutation, improve error handling:
const acceptRequest = useMutation({
  mutationFn: async (request: StudyRequest) => {
    // First create study mate connections (using upsert pattern)
    const { error: mate1Error } = await supabase
      .from('study_mates')
      .upsert({ user_id: request.from_user_id, mate_id: request.to_user_id }, 
        { onConflict: 'user_id,mate_id' });
    
    const { error: mate2Error } = await supabase
      .from('study_mates')
      .upsert({ user_id: request.to_user_id, mate_id: request.from_user_id },
        { onConflict: 'user_id,mate_id' });
    
    // Delete the request regardless
    await supabase.from('study_requests').delete().eq('id', request.id);
  },
  // ...
});
```

**Also fix rejectRequest:**
```tsx
const rejectRequest = useMutation({
  mutationFn: async (requestId: string) => {
    // Delete instead of update to avoid permission issues
    const { error } = await supabase
      .from('study_requests')
      .delete()
      .eq('id', requestId);
    if (error) throw error;
  },
  // ...
});
```

---

## Phase 7: Calculation Card Design

**Requirement:** Create a visually distinct card for math calculations vs. essay-style explanations.

**Approach:** Auto-detect math-heavy messages and apply special styling.

**File:** `src/components/ChatMessage.tsx`

**Detection Logic:**
```tsx
const isMathHeavy = (content: string) => {
  const mathIndicators = [
    /[×÷=²³⁴⁵⁶⁷⁸⁹⁰√π∞∫Σ]/g,  // Math symbols
    /\d+\s*[+\-×÷*/]\s*\d+/g,   // Basic operations
    /Step \d+:/gi,              // Step-by-step solutions
    /\d+\.\d+/g,                // Decimals
  ];
  const matches = mathIndicators.reduce((count, regex) => 
    count + (content.match(regex)?.length || 0), 0);
  return matches > 3; // Threshold for "math-heavy"
};
```

**Styling Changes:**
```tsx
// Add new CSS class for calculation card
<div className={cn(
  'rounded-2xl p-4 relative',
  isUser ? 'chat-bubble-user' : 'chat-bubble-assistant',
  isMathHeavy(formattedContent) && !isUser && 'calculation-card'
)}>
```

**New CSS in `src/index.css`:**
```css
.calculation-card {
  @apply bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-primary/20;
  font-family: 'JetBrains Mono', monospace;
}

.calculation-card p {
  @apply leading-loose;
}

/* Math steps get extra spacing */
.calculation-card li {
  @apply py-1;
}
```

---

## Phase 8: Comprehensive Exam After Lectures

**Requirement:** After covering a topic, generate 10-question exam:
- 5 objective (multiple choice)
- 5 theory (define, list, solve)
- 1 tricky "out of the box" question

**Implementation:**
Update `supabase/functions/xplane-chat/index.ts` to include exam format in prompt.

**Add to GIDEON_SYSTEM_PROMPT:**
```text
## Comprehensive Exam Format (After Topic Completion)

When you have fully covered a topic or PDF, generate a 10-question exam:

---
## [EXAM] Mastery Test 🎓

### Section A: Objective Questions (5 marks)
Select the correct answer:

**Q1.** [Question based on covered content]
A) ...
B) ...
C) ...
D) ...

[Continue Q2-Q5 same format]

### Section B: Theory Questions (5 marks)
Answer in your own words:

**Q6.** Define [key concept from the topic].

**Q7.** List [3-5 items] related to [topic aspect].

**Q8.** Solve: [Calculation problem if applicable]

**Q9.** Explain [concept] using a real-world example.

**Q10. (Bonus - Tricky!)** [Creative question that tests deep understanding, slightly outside what was explicitly taught but related]

---

Take your time! Submit your answers when ready.
```

---

## Phase 9: Wider Chat Input Area

**Requirement:** Make input wider like WhatsApp, or expand on focus.

**File:** `src/pages/Chat.tsx`

**Solution:** Expand input on focus using Tailwind transition.

**Changes to Textarea (line 578-586):**
```tsx
<Textarea
  ref={textareaRef}
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Ask anything... I'll explain it simply"
  className="min-h-[52px] max-h-[200px] resize-none bg-secondary border-border 
    focus:border-primary input-glow pr-12
    transition-all duration-200
    focus:min-h-[80px]"
  rows={1}
/>
```

**Also update container (line 556):**
```tsx
<div className="max-w-4xl mx-auto flex items-end gap-3">
// Change to:
<div className="max-w-5xl mx-auto flex items-end gap-2 md:gap-3">
```

---

## Phase 10: Star Rating on Discover Cards

**Current Status:** Already implemented! Star ratings appear on user cards.

**Verification:**
- Line 362-364 in `Community.tsx`: `{renderStars(profile.settings?.star_rating)}`
- Line 270-281: `renderStars()` function properly renders filled/empty stars

**Potential Issue:** If stars aren't showing, it's because `user_public_profiles` view might not have data or the query isn't returning properly.

**Ensure the view works:**
The view `user_public_profiles` was created with `security_invoker=on` which means RLS applies. Since `user_settings` now only allows users to see their own settings, the view won't work for other users.

**Fix Required:**
Create a SECURITY DEFINER function to bypass RLS for the public view:

```sql
-- Drop the old view
DROP VIEW IF EXISTS public.user_public_profiles;

-- Create a security definer function
CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE (user_id uuid, field_of_study text, star_rating numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, field_of_study, star_rating
  FROM user_settings;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated;
```

**Update `Community.tsx` to use the function:**
```tsx
const { data: publicSettings } = await supabase
  .rpc('get_public_profiles')
  .in('user_id', userIds);
```

---

## Security: user_settings RLS (Already Fixed)

**Status:** The view `user_public_profiles` was created to expose only `user_id`, `field_of_study`, and `star_rating`. However, as noted above, since it uses `security_invoker=on`, RLS applies and blocks access.

**The Phase 10 fix above will resolve this by using a SECURITY DEFINER function instead.**

---

## Technical Implementation Order

1. **Database Migration** (Phase 3, 6, 10)
   - Add `exam_sample_text`, `exam_sample_file_id` to `user_settings`
   - Add unique constraint to `study_mates`
   - Create `get_public_profiles()` function

2. **Edge Function Updates** (Phase 5, 8)
   - Update `xplane-chat/index.ts` with lecture mode and exam format

3. **UI Changes** (Phases 1, 2, 4, 7, 9)
   - `Chat.tsx`: Gideon naming, sticky layout, wider input
   - `ChatMessage.tsx`: Calculation card detection
   - `Dashboard.tsx`: Mobile icons
   - `Community.tsx`: Mobile icons, star rating fix

4. **Settings Page** (Phase 3)
   - Add exam sample section

5. **Bug Fixes** (Phase 6)
   - Study mate request mutations

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/pages/Chat.tsx` | Rename to Gideon, sticky layout, wider input, lecture button |
| `src/pages/Dashboard.tsx` | Mobile-responsive nav buttons |
| `src/pages/Community.tsx` | Mobile-responsive, fix request mutations, update star query |
| `src/pages/Settings.tsx` | Add exam sample section |
| `src/components/ChatMessage.tsx` | Add calculation card detection |
| `src/index.css` | Add calculation card styles |
| `supabase/functions/xplane-chat/index.ts` | Lecture mode, exam format |
| `supabase/functions/session-chat/index.ts` | Merge exam samples from participants |
| New migration | Add columns, constraints, function |

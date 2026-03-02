
# Plan: Voice Upgrade, Countries, Wallet Redesign, Onboarding & Help Desk

## 1. Upgrade Voice to ElevenLabs TTS (Natural Human Voice)

The current "Read Aloud" feature uses the browser's built-in `SpeechSynthesis` API, which always sounds robotic. We'll replace it with ElevenLabs Text-to-Speech for natural, human-like voice output.

**Backend:**
- Create edge function `supabase/functions/elevenlabs-tts/index.ts` that:
  - Receives text from the client
  - Calls ElevenLabs TTS API with a warm, friendly voice (e.g. "Sarah" or "Jessica")
  - Uses `eleven_turbo_v2_5` model for fast generation
  - Streams audio back as binary MP3
  - Configures voice settings for warmth (stability ~0.4, style ~0.3) to match the "close friend" personality

**Frontend:**
- Update `src/hooks/useVoice.ts`:
  - Replace the `speak()` function to call the ElevenLabs edge function via `fetch()` with `.blob()`
  - Play audio using `new Audio(URL.createObjectURL(blob))`
  - Keep browser SpeechSynthesis as a fallback if the edge function fails
  - Track playing state with the Audio element's `onplay`/`onended` events

**Config:**
- Add `elevenlabs-tts` function entry to `supabase/config.toml` with `verify_jwt = false`

---

## 2. Add More African Countries to Settings

Update the `COUNTRIES` array in `src/pages/Settings.tsx` to include all major African nations plus more global options. Expand from the current ~11 entries to ~60+ countries, organized by region (Africa first, then other continents).

Countries to add include: Tanzania, Uganda, Ethiopia, Rwanda, Cameroon, Senegal, Ivory Coast, Zimbabwe, Mozambique, DR Congo, Angola, Zambia, Malawi, Botswana, Namibia, Sierra Leone, Liberia, Somalia, Sudan, Tunisia, Morocco, Algeria, Libya, Madagascar, Mali, Niger, Burkina Faso, Benin, Togo, Guinea, Gambia, Mauritius, and more.

---

## 3. Redesign Wallet/KU Purchase Tab (Fintech Style)

Redesign `src/components/KUPurchase.tsx` and the wallet section of `src/pages/Settings.tsx` to look like a professional fintech app:

- **Balance Card**: Large gradient card at top showing balance prominently, with a subtle wallet icon and "Available Balance" label (similar to Opay/Kuda/Palmpay style)
- **Quick-Buy Grid**: Redesign package cards with colored accent borders, popular tag on "Standard", cleaner typography with unit price breakdown
- **Transaction-like Layout**: Add section headers like "Top Up", "Custom Amount" with clean dividers
- **Pending Payments**: Styled as transaction list items with status indicators (yellow dot for pending)
- **Professional touches**: Subtle shadows, rounded corners, proper spacing, currency formatting

---

## 4. New User Onboarding Prompt

Add a banner/card on the Dashboard (`src/pages/Dashboard.tsx`) that shows only when a user hasn't set up their preferences yet (no `user_settings` record or key fields are null).

- Display a friendly card: "Set up your preferences to get the best from Ezra" with a "Set Up Now" button that navigates to Settings
- Auto-dismiss once preferences are saved
- Check if `preferred_name`, `field_of_study`, and `ai_personality` are configured
- Styled as a highlighted info card with a sparkle/wand icon

---

## 5. Help Desk / "How To" Section in Settings

Add a new tab called "Help" to the Settings page with an accordion-based FAQ/guide:

- **Tab**: Add a 4th tab "Help" with a `HelpCircle` icon
- **Content**: Accordion sections covering:
  - "How to set up your preferences" - step-by-step guide
  - "How to chat with Ezra effectively" - tips for better prompts
  - "How to use Exam Mode" - walkthrough
  - "How to use the Library" - upload and manage files
  - "How to buy Knowledge Units" - payment guide
  - "How to use Study Groups" - creating and joining
  - "How to refer friends" - referral program explanation
  - "How to use Assignment Assist" - 2 KU per prompt feature
- Uses the existing `Accordion` component from the UI library
- Clean, readable formatting with step numbers and tips

---

## Technical Details

### Files to Create:
- `supabase/functions/elevenlabs-tts/index.ts` - ElevenLabs TTS edge function

### Files to Modify:
- `src/hooks/useVoice.ts` - Replace browser TTS with ElevenLabs
- `src/pages/Settings.tsx` - Add countries, Help tab, wallet redesign
- `src/components/KUPurchase.tsx` - Fintech-style redesign
- `src/pages/Dashboard.tsx` - Add onboarding prompt for new users
- `supabase/config.toml` - Add elevenlabs-tts function config

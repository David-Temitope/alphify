

# Fix: Gideon PDF Lecturing - Align with Actual Document Content

## Problem
When a user uploads a PDF and clicks "Lecture This PDF", Gideon fabricates content based on the filename instead of the actual document. This happens because the PDF text is never extracted -- the system only passes a placeholder string like "[User uploaded PDF: GST_111.pdf]" to the AI.

## Root Cause
In the file upload component, PDFs are handled with a placeholder message (unlike text files which are read directly, or images which are analyzed via an edge function). The AI never receives the actual document text.

## Solution

### 1. Create a new backend function: `extract-pdf-text`
A new backend function that accepts a PDF file (as base64) and uses the Gemini vision model to extract text content page-by-page.

- Accepts: `{ pdfBase64: string, mimeType: string }`
- Uses the Lovable AI Gateway with `google/gemini-2.5-flash` (multimodal, can read PDFs)
- Sends the PDF with a carefully crafted prompt that instructs the model to:
  - Identify title pages, metadata pages, and table of contents
  - Clearly separate them from actual course content
  - Return a structured extraction with page markers
- Returns: `{ text: string, pageCount: number }`

### 2. Update the file upload component (`FileUpload.tsx`)
Modify the PDF handling branch to:
- Convert the PDF to base64 (same pattern already used for images)
- Call the new `extract-pdf-text` backend function
- Pass the extracted text as `fileContent` instead of the placeholder

### 3. Improve the system prompt in `xplane-chat` edge function
Add specific instructions for LECTURE_MODE when file content is present:
- Explicitly tell Gideon to lecture ONLY from the provided document text
- Instruct it to skip title pages, author info, and other metadata
- Tell it to identify where actual topics begin
- Emphasize: "Do NOT add information that is not in the document. If something is unclear, say so."

### 4. Add LECTURE_MODE detection in the system prompt
When the user message contains `[LECTURE_MODE]`, append stricter instructions:
- "You are in Document Lecture Mode. You must ONLY teach content that appears in the document below."
- "Start by identifying the document structure: title page, table of contents, and content pages."
- "Begin lecturing from where the actual content starts, not the title page."
- "Never fabricate or hallucinate content. Every fact you teach must come from the document."

## Technical Details

### New file: `supabase/functions/extract-pdf-text/index.ts`
- Uses Lovable AI Gateway with `google/gemini-2.5-flash` (supports PDF/image input)
- Sends the PDF as a base64-encoded part with a structured extraction prompt
- The prompt will instruct: "Extract ALL text content from this PDF. Mark each page. Identify which pages are title/cover pages vs actual content pages."

### Modified: `src/components/FileUpload.tsx`
- PDF branch: read file as base64, call `extract-pdf-text`, use returned text as content
- Fallback: if extraction fails, keep the current placeholder behavior

### Modified: `supabase/functions/xplane-chat/index.ts`
- Detect `[LECTURE_MODE]` in the last user message
- When detected + fileContent present, append strict document-fidelity instructions to the system prompt
- Add: "CRITICAL: You are lecturing from a specific document. Do NOT introduce any information that is not present in the document text below. If the document starts with a title page or cover page, acknowledge it briefly and move to where the actual content begins."

### Modified: `supabase/config.toml`
- Add the new `extract-pdf-text` function with `verify_jwt = false`

## Expected Outcome
- Gideon will now receive the actual extracted text from PDFs
- In Lecture Mode, Gideon will strictly follow the document content
- Title pages and metadata will be acknowledged but skipped
- The lecture will align with what is actually in the document


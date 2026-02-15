

# Fix: Library Files Not Getting PDF Text Extracted

## Problem
When a user opens a PDF from the **library** (via the `?file=` URL parameter), the system sets a placeholder string like `"[User wants to discuss file: GST_111.pdf...]"` instead of extracting the actual PDF content. The `extract-pdf-text` function only runs when uploading a **new** file through `FileUpload.tsx`.

This is why Gideon says "the document text provided is just a placeholder title" and asks the user to paste the text manually.

## Root Cause
In `Chat.tsx` lines 110-119, when a library file is loaded, it creates a simple placeholder string and never calls the `extract-pdf-text` backend function.

## Solution

### Update `Chat.tsx` - Library File Loading
When a PDF file is loaded from the library:

1. Download the file from storage using its `file_path`
2. Convert it to base64
3. Call the `extract-pdf-text` backend function (same one used by direct uploads)
4. Set the extracted text as `fileContent`
5. Show a loading state while extraction is in progress

For non-PDF library files, keep the current placeholder behavior.

### Technical Steps

1. **Add a loading state** (`isExtractingFile`) to show a "Extracting document text..." indicator while the PDF is being processed from the library.

2. **Modify the `useEffect` for library file** (lines 110-119) to:
   - Check if the file is a PDF (`file_type === 'application/pdf'`)
   - If PDF: download from storage, convert to base64, call `extract-pdf-text`, use the result
   - If not PDF: keep current placeholder behavior
   - Handle errors gracefully with a fallback message

3. **Add a visual indicator** in the chat area showing "Extracting document text..." while the extraction runs, so the user knows something is happening.

### Files to Modify
- `src/pages/Chat.tsx` - Add PDF extraction logic for library files

### No Backend Changes Needed
The `extract-pdf-text` edge function already exists and works. We just need to call it from the library file loading path too.


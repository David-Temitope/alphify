

# Global University Files and Department Admins

## Overview
Replace the personal library with a shared university file system. Department admins (assigned by you) upload course files and exam samples that all students in the same university, department, and level can access. This reduces storage usage dramatically since one file serves hundreds of students.

## How It Works

```text
+-----------------------------------------------------+
|  You (App Owner)                                     |
|  Assign admin role:                                  |
|  "University of Abuja / Microbiology / 100L"         |
+-----------------------------------------------------+
                    |
                    v
+-----------------------------------------------------+
|  Department Admin                                    |
|  Uploads MCB101.pdf and exam samples                 |
|  for University of Abuja / Microbiology / 100L       |
+-----------------------------------------------------+
                    |
                    v
+-----------------------------------------------------+
|  All Students                                        |
|  with university = "University of Abuja"             |
|  field_of_study = "Microbiology"                     |
|  university_level = "100L"                           |
|  can see and use those files                         |
+-----------------------------------------------------+
```

## Database Changes

### 1. Add `university` field to `user_settings`
Add a new text column `university` so students can specify their university name (e.g., "University of Abuja").

### 2. Create `department_admins` table
Stores which users are admins for which university/department/level combination. Only you can insert rows here (via a backend function or direct database access).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | The admin user |
| university | text | e.g., "University of Abuja" |
| department | text | e.g., "Microbiology" |
| level | text | e.g., "100L" |
| created_at | timestamp | When assigned |

RLS: Users can only SELECT their own rows. No INSERT/UPDATE/DELETE from client side (admin assignment is done by you via the database directly).

### 3. Create `shared_files` table
Stores files uploaded by department admins that are accessible to all matching students.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| uploaded_by | uuid | Admin who uploaded |
| university | text | Target university |
| department | text | Target department |
| level | text | Target level |
| course_code | text | e.g., "MCB101" |
| file_name | text | Original filename |
| file_path | text | Path in storage bucket |
| file_type | text | MIME type |
| file_size | bigint | Size in bytes |
| extracted_text | text | Extracted PDF/document text (cached) |
| file_category | text | 'course_material' or 'exam_sample' |
| created_at | timestamp | Upload time |

RLS:
- SELECT: Any authenticated user whose `user_settings` matches the file's university + department + level can read
- INSERT: Only department admins for the matching university/department/level
- DELETE: Only the uploader

### 4. Create security definer functions
To avoid RLS recursion when checking if a user matches a shared file's target audience or is a department admin:

- `is_department_admin(user_id, university, department, level)` - checks the `department_admins` table
- `user_matches_shared_file(user_id, university, department, level)` - checks if user's settings match

## Frontend Changes

### 1. Settings Page - Add University Field
Add a text input field for "University Name" in the Academic Information section (alongside field of study and level). This is critical because it determines which shared files a student can access.

### 2. Replace Library Page
Transform the Library page from personal files to shared university files:

- Show files filtered by the student's university + department + level
- If the user is a department admin, show an "Upload" button and a file category selector (course material vs exam sample)
- If the user is NOT an admin, the library is read-only (browse and "Ask Gideon about this" only)
- Remove the personal slot system (no more slot purchases)
- Group files by course code for easy navigation

### 3. Admin Upload Flow
When a department admin uploads a file:
- Upload to storage at path: `shared/{university}/{department}/{level}/{course_code}/{filename}`
- If it's a PDF, automatically call `extract-pdf-text` and cache the extracted text in `shared_files.extracted_text`
- If it's an exam sample, also extract text so Gideon can reference it
- Save the record to `shared_files` table

### 4. Chat Page - Use Shared Files
When a student opens a shared file from the library:
- If `extracted_text` is already cached in the database, use it directly (no need to re-extract -- saves AI credits)
- If not cached, download and extract, then cache for future students
- Pass the text to Gideon as `fileContent` just like personal files work today

### 5. Exam Samples Integration
When Gideon generates quizzes/exams for a student:
- The `xplane-chat` edge function will query `shared_files` for exam samples matching the student's university + department + level + course
- Include those exam sample texts in the system prompt so Gideon mimics the professor's style
- This replaces the current per-user exam sample upload in Settings (though the general text field can remain as a fallback)

## Backend Changes

### 1. Update `xplane-chat` Edge Function
- Before building the system prompt, query `shared_files` for exam samples matching the student's profile
- Append exam sample text to the system prompt: "Here are past exam questions from this student's university for reference..."

### 2. Storage Organization
- Keep the `user-files` bucket
- Add a `shared/` prefix for shared university files
- Storage RLS: Allow department admins to upload to `shared/` paths, allow matching students to download

### 3. Text Extraction Caching
- When an admin uploads a PDF, extract text immediately and store in `shared_files.extracted_text`
- When any student accesses the file, serve the cached text instead of re-extracting
- This saves significant AI processing since extraction happens once, not per-student

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| Migration SQL | Create | Add `university` column, create `department_admins`, `shared_files` tables, security definer functions, RLS policies |
| `src/pages/Settings.tsx` | Modify | Add university name input field |
| `src/pages/Library.tsx` | Rewrite | Show shared files, admin upload, remove personal slot system |
| `src/pages/Chat.tsx` | Modify | Load shared file content (prefer cached text), pass to Gideon |
| `src/components/FileUpload.tsx` | Modify | Support shared file uploads with category selection (course material vs exam sample) |
| `supabase/functions/xplane-chat/index.ts` | Modify | Query shared exam samples for the student's profile and include in system prompt |

## Security Considerations
- Department admin assignment is done by you directly in the database -- no client-side admin creation
- RLS ensures students can only see files matching their university/department/level
- Admins can only upload to their assigned university/department/level
- The `extracted_text` column is readable only by matching students (protected by RLS)
- No privilege escalation: admin status is checked via a security definer function, not stored on profiles


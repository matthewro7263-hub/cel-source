Summary of Changes:
- Modified 'scripts' table to include sourceType, sourceFormat, and originalKey columns.
- Added POST /api/projects/:projectId/scripts/upload endpoint parsing via multer, pdf-parse, mammoth, uploading direct to R2, and returning a new script item with formatted database row entries.
- Added GET /api/projects/:projectId/scripts/:scriptId/original endpoint for returning the original asset's presigned download link.
- Implemented Frontend 'Upload script' button with a Drag & Drop dialog configured to restrict payload mapping.
- Handled viewer rendering using react-pdf (PDF with extracted text fallback layer), DOMPurify (to prevent XSS inside dangerouslySetInnerHTML for mammoth's DOCX extraction), and react-markdown.
- Integrated unit tests for endpoint upload format type checking and payload sizing parameters.

Dependencies Added:
- pdf-parse
- mammoth
- dompurify
- @types/dompurify
- react-pdf
- multer
- @types/multer

Manual test checklist:
- [ ] upload .pdf, .docx, .md and confirm view + download original

Note: Pre-existing TS errors observed regarding User.id mismatch across routes are out of scope and do not stem from these alterations.

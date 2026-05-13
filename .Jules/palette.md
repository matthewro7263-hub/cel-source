## 2024-05-24 - [Add ARIA labels to Remove Tag icon-only buttons]
**Learning:** Missing aria-labels on icon-only buttons like the remove tag (X) button is a common accessibility issue across various components (Quick Capture, Tag Manager).
**Action:** Always check icon-only buttons for proper aria-labels to ensure screen reader compatibility, especially within map functions where buttons are dynamically generated.

## 2025-05-13 - YouTube ID Parsing Regex Update
**Learning:** The existing YouTube ID parsing regex did not account for YouTube Shorts URLs (e.g., `youtube.com/shorts/...`), causing it to fail to extract the ID correctly.
**Action:** Updated the regex in `youTubeId` function to explicitly handle the `shorts/` path segment alongside `v/` and `embed/`.

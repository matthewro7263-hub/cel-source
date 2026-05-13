## 2024-05-24 - [Add ARIA labels to Remove Tag icon-only buttons]
**Learning:** Missing aria-labels on icon-only buttons like the remove tag (X) button is a common accessibility issue across various components (Quick Capture, Tag Manager).
**Action:** Always check icon-only buttons for proper aria-labels to ensure screen reader compatibility, especially within map functions where buttons are dynamically generated.
## 2026-05-13 - Optimization of N+1 database queries using IN clause
**Learning:** Found that sequential database queries inside map/flatMap (N+1 queries) can be up to 3x slower (13ms vs 4.3ms locally) compared to fetching relation IDs first and using a single `WHERE IN` (`inArray`) query for all child rows.
**Action:** Replaced `flatMap` N+1 query patterns with single `inArray` queries across the server codebase for fetching related rows, particularly when accessing nested child collections like storyboard panels.

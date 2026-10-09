# Workspace Codebase Navigation & Agent Commands

## 1. Zero-Guesswork Codebase Navigation
To minimize token consumption and avoid redundant repository-wide searches:
1. **Always Check the Project Map First**:
   Consult `.agents/planning/CODEBASE_MAP.md` before performing file searches, ripgrep sweeps, or directory listings.
2. **Use the Fast-Lookup Matrix**:
   Use Section 2 ("Fast-Lookup Decision Matrix") in `CODEBASE_MAP.md` to instantly locate relevant routes, UI components, and state stores for any given task.
3. **Direct File Inspection**:
   Access the target files directly using targeted line slicing instead of bulk reading.

---

## 2. Command Trigger: `/update-agents`
When the user triggers or commands `/update-agents`:
1. **Scan the Project**:
   Inspect `client/app/(app)/` for new routes, `client/components/` for new components, `client/lib/` for new stores, utilities, or types, and `server/src/modules/` + `server/db/schemas/` for new API modules and collections.
2. **Synchronize `CODEBASE_MAP.md`**:
   Update `.agents/planning/CODEBASE_MAP.md` to accurately document:
   - Newly added or modified pages and their route URLs.
   - New UI components and their responsibilities.
   - New or updated state stores, storage keys, and business logic files.
   - Updated entries in Section 2 ("Fast-Lookup Decision Matrix").
3. **Report Changes**:
   Provide the user with a concise summary of what was discovered and updated in the project map.

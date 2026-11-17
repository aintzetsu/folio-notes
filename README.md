# Folio Notes

Local-first Markdown notebook and interactive knowledge graph stored inside `IndexedDB`.

## Features
- **Split Markdown Workspace**: Live XSS-safe Markdown preview (`h1–h3`, code fences, blockquotes, lists, interactive `- [ ]` task checkboxes, `#tags`, and `[[Wiki Links]]`).
- **Bi-Directional Backlinks & Instant Topic Creation**: Click existing `[[Wiki Links]]` to jump or unresolved links to create & open linked notes automatically.
- **Interactive Force Graph**: Visual `<canvas>` knowledge graph where dragging rearranges nodes and clicking opens the note.
- **Offline Persistence & Export**: Auto-saved to `IndexedDB` (with `localStorage` fallback), single-note `.md` download, and full vault `.json` export.

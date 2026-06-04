# Ajaia Docs

A lightweight collaborative document editor built with Next.js as part of the Ajaia AI-native full-stack engineering assignment. Users can create, rename, and edit rich-text documents, import files, share documents with other users, and return to their work after a page refresh — all in a clean, focused browser experience.

---

## Features

- **Rich-text editing** — Bold, italic, underline, headings (H1–H3), bullet lists, and numbered lists via Tiptap
- **Document management** — Create, rename, delete, and reopen documents from a persistent sidebar
- **File upload** — Import `.txt` or `.md` files directly into a new editable document
- **Sharing** — Grant another registered user access to your document by email; owned and shared documents are visually separated
- **Persistence** — All documents, formatting, and sharing data survive page refresh (PostgreSQL via Supabase)
- **Auth** — Session-based login with two seeded demo accounts ready for reviewer testing

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Editor | Tiptap (ProseMirror-based rich-text) |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Supabase |
| Auth | NextAuth.js (Credentials provider) |
| Language | TypeScript |
| Testing | Jest + React Testing Library |

---

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A free [Supabase](https://supabase.com) project **or** a local PostgreSQL 14+ instance

---

## Project Structure

```
Ajaia-docs/
├── app/
│   ├── page.tsx                    # Home — document list
│   ├── login/
│   │   └── page.tsx                # Login page
│   ├── documents/
│   │   └── [id]/
│   │       └── page.tsx            # Document editor
│   └── api/
│       ├── auth/[...nextauth]/     # NextAuth handler
│       ├── documents/              # GET list, POST create, GET/PUT/DELETE by id
│       ├── documents/[id]/share/   # POST grant, DELETE revoke
│       └── upload/                 # POST file import
├── components/
│   ├── Editor.tsx                  # Tiptap editor
│   ├── Toolbar.tsx                 # Formatting toolbar
│   ├── Sidebar.tsx                 # Document list (owned + shared sections)
│   └── ShareModal.tsx              # Share-by-email dialog
├── lib/
│   ├── db.ts                       # PostgreSQL connection pool
│   └── auth.ts                     # NextAuth configuration
├── migrations/                     # SQL migration files
├── scripts/
│   └── seed.ts                     # Demo account seeder
├── __tests__/                      # Jest test files
├── ARCHITECTURE.md
├── AI_WORKFLOW.md
├── SUBMISSION.md
├── .env.example
└── README.md
```

---

## Known Limitations

- No real-time collaboration — simultaneous edits do not sync between sessions
- All shares grant edit access; there is no viewer-only permission level
- `.docx` upload is not supported in this version
- No email notification when a document is shared
- Mobile layout is functional but not fully polished

See `ARCHITECTURE.md` for the full prioritisation rationale and what I would build next.

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

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Sandip-Dabhi918/Ajaia-docs.git
cd Ajaia-docs
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Supabase / PostgreSQL connection string
DATABASE_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres

# NextAuth — generate a random 32-char string for the secret
NEXTAUTH_SECRET=replace_with_a_random_string
NEXTAUTH_URL=http://localhost:3000
```

> **Using local PostgreSQL instead of Supabase?**
> Set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ajaia_docs` and make sure the database exists.

### 4. Run database migrations

```bash
npm run db:migrate
```

Creates the `users`, `documents`, and `document_shares` tables.

### 5. Seed demo accounts

```bash
npm run db:seed
```

This creates two accounts you can use immediately to test the sharing flow:

| Email | Password | Role in demo |
|---|---|---|
| alice@demo.com | password123 | Document owner |
| bob@demo.com | password123 | Shared-with user |

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Tests

```bash
npm test
```

Runs Jest unit tests and API route tests. See `__tests__/` for details.

---

## Supported File Upload Types

| Type | Behaviour |
|---|---|
| `.txt` | Imported as plain text into a new document |
| `.md` | Imported as plain text into a new document |

All other file types are rejected with a clear error message in the UI.
`.docx` import is not supported in this version — see `ARCHITECTURE.md` for context.

---

## Demo: Sharing Flow

1. Log in as **alice@demo.com**
2. Create or open a document
3. Click the **Share** button in the top-right toolbar
4. Enter `bob@demo.com` and confirm
5. Log out, then log in as **bob@demo.com**
6. The shared document appears in Bob's sidebar under **Shared with me**

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

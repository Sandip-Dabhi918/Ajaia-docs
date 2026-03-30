# Architecture Note — Ajaia Docs

## What I Built

Ajaia Docs is a Next.js full-stack application covering all four core requirements from the assignment brief: rich-text document editing, file upload, sharing, and persistence. The goal was a coherent, working product slice — not a complete Google Docs clone — delivered within a 4–6 hour timebox.

---

## Prioritisation Decisions

### 1. Editor experience — highest priority

The document editor is the product's core surface. I chose **Tiptap** (ProseMirror-based) because it is headless, TypeScript-native, and integrates cleanly with React via hooks. It delivered bold, italic, underline, headings, and lists with minimal configuration — leaving the majority of my time for the surrounding product logic rather than reinventing text rendering.

Document content is stored as **Tiptap JSON** (a ProseMirror document tree) rather than raw HTML. HTML has implicit rendering state that is messy to diff, migrate, or process server-side. JSON is stable, inspectable, and straightforward to version or transform later.

Auto-save is implemented with a 500ms debounce on editor changes — no manual save button, no constant network noise.

### 2. Persistence — foundational dependency

Everything else depends on persistence. I used **PostgreSQL via Supabase** — a real relational database behind a single `DATABASE_URL` environment variable, requiring no local database installation for reviewers.

**Schema:**

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT 'Untitled',
  content     JSONB NOT NULL DEFAULT '{}',
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE document_shares (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (document_id, shared_with_user_id)
);
```

`content` is stored as `jsonb` so Postgres can query into it if needed later, and so it survives schema evolution without a data migration.

### 3. Sharing — simple model with clear intent

A row in `document_shares` means the referenced user can access and edit the document. Ownership is tracked via `documents.owner_id`. The sidebar renders two distinct sections — **My Documents** and **Shared with me** — using a single query with a left join on the shares table.

Sharing is triggered by email address rather than user ID — reviewers and real users don't know internal IDs. The server resolves email → user ID before inserting the share row, returning a clear error if the email is not found.

### 4. File upload — scoped, not over-engineered

`.txt` and `.md` files are read server-side, converted into Tiptap JSON paragraph nodes, and saved as a new document. The result opens immediately in the editor.

`.docx` was deliberately skipped. Parsing Word documents reliably requires `mammoth.js` and substantial edge-case handling around embedded images, complex tables, and tracked changes — not a good use of timebox hours. The UI states the supported types clearly.

Unsupported file types return `415 Unsupported Media Type` at the API level with a matching UI error message.

### 5. Auth — minimal but real

Session-based auth using **NextAuth.js** with a Credentials provider and bcrypt password hashing. No OAuth — the focus is on document functionality, not identity infrastructure. Two seeded demo accounts (alice and bob) let reviewers demonstrate the sharing flow without registering.

---

## What I Deprioritised

| Feature | Reason |
|---|---|
| Real-time collaboration (WebSockets / CRDT) | Would consume the entire timebox alone; needs `y-prosemirror`, `y-websocket`, and a stateful server layer |
| Role-based permissions (viewer vs editor) | Adds schema and middleware complexity with low product signal at this scope |
| `.docx` upload | Reliable parsing requires `mammoth.js` plus significant edge-case work |
| Email notifications on share | No mail provider configured; clearly out of scope |
| Document version history | Valuable stretch goal; deprioritised in favour of getting core flows working end-to-end |
| Mobile-responsive polish | Desktop-first for this product context |

---

## What I Would Build Next (2–4 More Hours)

**Real-time collaboration**
Layer in `y-prosemirror` + `y-websocket` on top of the existing Tiptap editor. The Tiptap collaboration extension makes this additive — it doesn't require rewriting the editor. Add a presence indicator showing who else is viewing the document.

**Document version history**
On each save, insert a snapshot of `content` into a `document_versions` table with a timestamp and author. Expose a timeline sidebar in the editor. Diff two versions using a JSON diff library and render the changes inline.

**Role-based sharing**
Add a `role TEXT CHECK (role IN ('viewer', 'editor'))` column to `document_shares`. Enforce at the API layer — viewer sessions can `GET` but receive `403` on `PUT`. Surface a role selector in the share modal.

**`.docx` import**
Use `mammoth.js` on the Next.js API route to extract HTML, then convert to Tiptap JSON via `@tiptap/html`. Handle the most common Word formatting (headings, lists, bold/italic) faithfully.

**Export to PDF or Markdown**
Tiptap ships a first-party Markdown serialiser. For PDF, render the document page server-side with Puppeteer and stream the result as a download.

---

## API Surface

All routes live under `app/api/` as Next.js Route Handlers. All document mutation routes verify the session via `getServerSession` before executing.

```
POST   /api/auth/[...nextauth]          NextAuth — login, logout, session
GET    /api/documents                   List owned + shared documents for session user
POST   /api/documents                   Create new empty document
GET    /api/documents/:id               Fetch title + content
PUT    /api/documents/:id               Update title or content (owner or shared user)
DELETE /api/documents/:id               Delete document (owner only — 403 otherwise)
POST   /api/documents/:id/share         Grant access by email
GET    /api/documents/:id/share         List users with access
DELETE /api/documents/:id/share/:uid    Revoke access (owner only)
POST   /api/upload                      Upload .txt / .md → create and return new document
```

---

## Key Technical Decisions

**Next.js App Router over a separate Express backend** — One codebase, one `npm run dev`, API routes co-located with the UI. Right for this scope. Would revisit if the backend needed independent scaling or a separate deployment target.

**Tiptap over Quill or Draft.js** — Tiptap is actively maintained, headless, and TypeScript-native. Quill has a dated extension API; Draft.js is no longer maintained by Meta.

**Supabase Postgres over SQLite** — Supabase gives a hosted Postgres instance behind a single env var, so reviewers don't need a local database installed. The sharing flow is fully demonstrable from a clean clone.

**NextAuth.js** — Handles session cookies, CSRF protection, and Credentials provider correctly out of the box. Lower risk than writing custom session middleware under time pressure.

**No global state manager** — `useState`, `useReducer`, and two custom hooks (`useDocument`, `useDocumentList`) cover all state needs. Redux or Zustand would add meaningful complexity without meaningful benefit at this scope.

**Tiptap JSON over HTML for content storage** — The single most important data model decision. JSON is stable, diffable, and manipulable server-side. Raw HTML is fragile, renderer-dependent, and difficult to migrate or version.

"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import mammoth from "mammoth"
import Editor from "../components/Editor"
import AuthPage, { AuthLoading } from "../components/AuthPage"
import { useAuth } from "../lib/auth"
import { supabase } from "../lib/supabase"

// ── Types ──────────────────────────────────────────────────────────────────────

type Doc = {
  id: string
  title: string
  content: string
  owner: string
}

type Toast = { id: number; message: string; type: "success" | "error" }
type SaveState = "saved" | "saving" | "idle"

// ── Root component ─────────────────────────────────────────────────────────────

export default function Home() {
  const { user, logout, loading: authLoading } = useAuth()

  if (authLoading) return <AuthLoading />

  if (!user) return <AuthPage />

  return (
    <DocsApp
      currentUser={user.email}
      displayName={user.displayName}
      onLogout={logout}
    />
  )
}

// ── DocsApp ────────────────────────────────────────────────────────────────────

function DocsApp({
  currentUser,
  displayName,
  onLogout,
}: {
  currentUser: string
  displayName: string
  onLogout: () => void
}) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
  const [shareEmail, setShareEmail] = useState("")
  const [titleInput, setTitleInput] = useState("")
  const [toasts, setToasts] = useState<Toast[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [exporting, setExporting] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const toastIdRef = useRef(0)
  const activeDocRef = useRef<Doc | null>(null)
  const editorApiRef = useRef<{ getHTML: () => string } | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Toast ────────────────────────────────────────────────────────────────────

  const addToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      const id = ++toastIdRef.current
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== id)),
        3500
      )
    },
    []
  )

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchAllDocs = useCallback(async () => {
    const { data: myDocs } = await supabase
      .from("documents")
      .select("*")
      .eq("owner", currentUser)

    const { data: shareRows } = await supabase
      .from("shares")
      .select("document_id")
      .eq("user_email", currentUser)

    const sharedIds = (shareRows ?? []).map(
      (row: { document_id: string }) => row.document_id
    )

    let sharedDocs: Doc[] = []
    if (sharedIds.length > 0) {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .in("id", sharedIds)
      sharedDocs = data ?? []
    }

    const combined = [...(myDocs ?? []), ...sharedDocs]
    const unique = combined.filter(
      (doc, i, arr) => arr.findIndex((d) => d.id === doc.id) === i
    )
    setDocs(unique)
  }, [currentUser])

  useEffect(() => {
    fetchAllDocs()
  }, [fetchAllDocs])

  useEffect(() => {
    if (activeDoc) {
      setTitleInput(activeDoc.title)
      activeDocRef.current = activeDoc
    }
  }, [activeDoc?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  const createDoc = async () => {
    const { data, error } = await supabase
      .from("documents")
      .insert([{ title: "Untitled Document", content: "", owner: currentUser }])
      .select()
    if (error) {
      addToast("Failed to create document", "error")
      return
    }
    const newDoc = data![0] as Doc
    setDocs((prev) => [...prev, newDoc])
    setActiveDoc(newDoc)
    addToast("New document created")
  }

  const updateContent = useCallback(async (content: string) => {
    const doc = activeDocRef.current
    if (!doc) return
    await supabase.from("documents").update({ content }).eq("id", doc.id)
    setActiveDoc((prev) => (prev ? { ...prev, content } : prev))
    setSaveState("saved")
  }, [])

  const handleTitleBlur = async () => {
    if (!activeDoc) return
    const trimmed = titleInput.trim()
    if (!trimmed) {
      addToast("Title cannot be empty", "error")
      setTitleInput(activeDoc.title)
      return
    }
    if (trimmed === activeDoc.title) return
    const { error } = await supabase
      .from("documents")
      .update({ title: trimmed })
      .eq("id", activeDoc.id)
    if (error) {
      addToast("Failed to rename", "error")
      return
    }
    const updated: Doc = { ...activeDoc, title: trimmed }
    setActiveDoc(updated)
    setDocs((prev) => prev.map((d) => (d.id === activeDoc.id ? updated : d)))
    addToast("Document renamed")
  }

  const deleteDoc = async (doc: Doc, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id)
    if (error) {
      addToast("Failed to delete document", "error")
      return
    }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id))
    if (activeDoc?.id === doc.id) setActiveDoc(null)
    addToast(`"${doc.title}" deleted`)
  }

  // ── File import ──────────────────────────────────────────────────────────────

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    let content = ""
    try {
      if (file.name.endsWith(".txt") || file.name.endsWith(".md")) {
        const text = await file.text()
        content = `<p>${text
          .replace(/\n\n/g, "</p><p>")
          .replace(/\n/g, "<br>")}</p>`
      } else if (file.name.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer })
        content = result.value
      } else {
        addToast("Only .txt, .md and .docx files are supported", "error")
        return
      }
      if (!content.trim()) {
        addToast("File appears empty", "error")
        return
      }
      const { data, error } = await supabase
        .from("documents")
        .insert([{ title: file.name, content, owner: currentUser }])
        .select()
      if (error) {
        addToast("Upload failed", "error")
        return
      }
      const newDoc = data![0] as Doc
      setDocs((prev) => [...prev, newDoc])
      setActiveDoc(newDoc)
      addToast(`"${file.name}" imported successfully`)
    } catch (err) {
      console.error(err)
      addToast("Error reading file", "error")
    }
    if (fileRef.current) fileRef.current.value = ""
  }

  // ── Sharing ──────────────────────────────────────────────────────────────────

  const shareDoc = async () => {
    if (!activeDoc || !shareEmail.trim()) return
    if (!shareEmail.includes("@")) {
      addToast("Please enter a valid email", "error")
      return
    }
    if (shareEmail.trim().toLowerCase() === currentUser) {
      addToast("You already own this document", "error")
      return
    }
    const { error } = await supabase.from("shares").insert([
      {
        document_id: activeDoc.id,
        user_email: shareEmail.trim().toLowerCase(),
      },
    ])
    if (error) {
      addToast("Failed to share document", "error")
      return
    }
    addToast(`Shared with ${shareEmail}`)
    setShareEmail("")
    setShareOpen(false)
  }

  // ── PDF export ───────────────────────────────────────────────────────────────

  const exportPdf = async () => {
    if (!activeDoc) return
    setExporting(true)
    const html =
      editorApiRef.current?.getHTML() ?? activeDoc.content ?? "<p></p>"
    const printContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${activeDoc.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Lora', Georgia, serif; font-size: 12pt; line-height: 1.8; color: #1c1917; padding: 40px 60px 60px; }
    h1 { font-size: 22pt; margin: 1em 0 .4em; font-weight: 700; }
    h2 { font-size: 16pt; margin: .9em 0 .35em; font-weight: 600; }
    h3 { font-size: 13pt; margin: .8em 0 .3em; font-weight: 600; }
    p  { margin-bottom: .7em; }
    ul, ol { padding-left: 1.6em; margin-bottom: .7em; }
    li { margin-bottom: .25em; }
    blockquote { border-left: 3px solid #c2410c; padding: .5em 1.2em; color: #78716c; font-style: italic; margin: 1em 0; }
    code { background: #f3f4f6; border-radius: 3px; padding: .1em .35em; font-size: .88em; font-family: monospace; }
    pre  { background: #1c1917; color: #e7e5e4; border-radius: 6px; padding: 14px 18px; margin: 1em 0; }
    pre code { background: none; color: inherit; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    td, th { border: 1px solid #e7e5e4; padding: 8px 12px; text-align: left; }
    th { background: #fafaf9; font-weight: 600; font-size: 10pt; text-transform: uppercase; letter-spacing: .04em; color: #78716c; }
    .doc-title { font-size: 26pt; font-weight: 700; border-bottom: 2px solid #e7e5e4; padding-bottom: .4em; margin-bottom: 1.2em; }
    @media print { body { padding: 0; } @page { margin: 2.5cm; } }
  </style>
</head>
<body>
  <div class="doc-title">${activeDoc.title}</div>
  ${html}
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},400);};<\/script>
</body>
</html>`
    const blob = new Blob([printContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, "_blank")
    if (!win) addToast("Please allow popups to export PDF", "error")
    else addToast("Print dialog opened — save as PDF")
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    setExporting(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const myDocs = docs.filter((d) => d.owner === currentUser)
  const sharedDocs = docs.filter((d) => d.owner !== currentUser)
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
      ? "Saved ✓"
      : ""

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="app-root">

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            )}
            {t.message}
          </div>
        ))}
      </div>

      {/* Share modal */}
      {shareOpen && activeDoc && (
        <div className="modal-overlay" onClick={() => setShareOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Share document</h3>
              <button className="modal-close" onClick={() => setShareOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            <p className="modal-subtitle">
              Sharing: <strong>{activeDoc.title}</strong>
            </p>
            <div className="modal-input-row">
              <input
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && shareDoc()}
                placeholder="colleague@company.com"
                className="modal-input"
                autoFocus
              />
              <button onClick={shareDoc} className="btn-primary">
                Share
              </button>
            </div>
            <p className="modal-hint">
              Enter the email they will use to sign in with.
            </p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? "sidebar--open" : "sidebar--closed"}`}
      >
        <div className="sidebar-header">
          <div className="brand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="4" fill="var(--accent)" />
              <path
                d="M7 8h10M7 12h10M7 16h6"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            {sidebarOpen && <span className="brand-name">Ajaia Docs</span>}
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              {sidebarOpen ? (
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              ) : (
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
              )}
            </svg>
          </button>
        </div>

        {sidebarOpen && (
          <div className="sidebar-scroll">
            <button onClick={createDoc} className="new-doc-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
              </svg>
              New Document
            </button>

            <button
              className="upload-btn"
              onClick={() => fileRef.current?.click()}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />
              </svg>
              Import File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.docx"
              onChange={handleFile}
              className="hidden-file-input"
            />
            <p className="file-hint">Supports .txt · .md · .docx</p>

            {/* My Documents */}
            <div className="doc-section">
              <div className="doc-section-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" />
                </svg>
                My Documents
                <span className="badge">{myDocs.length}</span>
              </div>
              {myDocs.length === 0 && (
                <p className="empty-hint">No documents yet</p>
              )}
              {myDocs.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setActiveDoc(doc)}
                  className={`doc-item ${activeDoc?.id === doc.id ? "doc-item--active" : ""}`}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style={{ flexShrink: 0, opacity: 0.5 }}
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                  </svg>
                  <span className="doc-item-title">{doc.title}</span>
                  <button
                    className="doc-delete-btn"
                    title="Delete document"
                    onClick={(e) => deleteDoc(doc, e)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Shared with me */}
            {sharedDocs.length > 0 && (
              <div className="doc-section">
                <div className="doc-section-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" />
                  </svg>
                  Shared With Me
                  <span className="badge badge--shared">{sharedDocs.length}</span>
                </div>
                {sharedDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setActiveDoc(doc)}
                    className={`doc-item ${activeDoc?.id === doc.id ? "doc-item--active" : ""}`}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      style={{ flexShrink: 0, opacity: 0.5 }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    <span className="doc-item-title">{doc.title}</span>
                    <span className="shared-pill">shared</span>
                  </div>
                ))}
              </div>
            )}

            {/* User footer */}
            <div className="sidebar-user-footer">
              <div className="sidebar-avatar">{initials}</div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{displayName}</span>
                <span className="sidebar-user-email">{currentUser}</span>
              </div>
              <button
                className="sidebar-logout-btn"
                onClick={onLogout}
                title="Sign out"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main area */}
      <main className="main-area">
        {activeDoc ? (
          <>
            <div className="topbar">
              <div className="topbar-left">
                <input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    (e.target as HTMLInputElement).blur()
                  }
                  className="title-input"
                  placeholder="Untitled Document"
                />
                {saveLabel && (
                  <span
                    className={`save-indicator ${
                      saveState === "saving"
                        ? "save-indicator--saving"
                        : "save-indicator--saved"
                    }`}
                  >
                    {saveLabel}
                  </span>
                )}
              </div>

              <div className="topbar-right">
                <button
                  onClick={exportPdf}
                  className="export-btn"
                  disabled={exporting}
                  title="Export as PDF"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
                  </svg>
                  {exporting ? "Exporting…" : "Export PDF"}
                </button>

                {activeDoc.owner === currentUser ? (
                  <button
                    onClick={() => setShareOpen(true)}
                    className="share-btn"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" />
                    </svg>
                    Share
                  </button>
                ) : (
                  <span className="owner-badge">Shared doc</span>
                )}

                {/* User avatar + dropdown */}
                <div className="user-menu-wrapper" ref={userMenuRef}>
                  <button
                    className="user-avatar-btn"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    title={`${displayName} (${currentUser})`}
                  >
                    {initials}
                  </button>
                  {userMenuOpen && (
                    <div className="user-menu">
                      <div className="user-menu-info">
                        <span className="user-menu-name">{displayName}</span>
                        <span className="user-menu-email">{currentUser}</span>
                      </div>
                      <div className="user-menu-divider" />
                      <button
                        className="user-menu-item user-menu-item--danger"
                        onClick={onLogout}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="doc-scroll-area">
              <div className="doc-page">
                <Editor
                  key={activeDoc.id}
                  content={activeDoc.content}
                  onChange={updateContent}
                  onSaveStart={() => setSaveState("saving")}
                  onSaveEnd={() => setSaveState("saved")}
                  editorRef={editorApiRef}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="4"
                  fill="var(--accent)"
                  opacity="0.12"
                />
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M14 2v6h6M8 13h8M8 17h5"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2 className="empty-title">Welcome, {displayName}!</h2>
            <p className="empty-sub">
              Create a new document or select one from the sidebar to get
              started.
            </p>
            <button onClick={createDoc} className="btn-primary">
              + Create Document
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
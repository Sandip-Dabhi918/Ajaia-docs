"use client"

import { useState } from "react"
import { useAuth } from "../lib/auth"
import s from "./AuthPage.module.css"

type Mode = "login" | "signup"

// ── Loading screen (shown while localStorage is being read) ──────────────────

export function AuthLoading() {
  return (
    <div className={s.loading}>
      <div className={s.spinner} />
    </div>
  )
}

// ── Auth page ─────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const { login, signup } = useAuth()

  const [mode, setMode] = useState<Mode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError("")
  }

  const handleSubmit = async () => {
    setError("")
    if (!email.trim()) { setError("Please enter an email address"); return }
    if (!password.trim()) { setError("Please enter a password"); return }
    setLoading(true)
    try {
      if (mode === "signup") {
        await signup(email, password, displayName)
      } else {
        await login(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit()
  }

  const quickFill = (demoEmail: string) => {
    setMode("login")
    setEmail(demoEmail)
    setPassword("demo")
    setError("")
  }

  const seedUsers = ["alice@ajaia.com", "bob@ajaia.com", "charlie@ajaia.com"]

  return (
    <div className={s.root}>

      {/* ── Left branding panel ─────────────────────────────────────────── */}
      <div className={s.brandPanel}>
        <div className={s.brandInner}>
          <div className={s.logo}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="5" fill="white" opacity="0.15" />
              <path
                d="M7 8h10M7 12h10M7 16h6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h1 className={s.brandName}>Ajaia Docs</h1>
          <p className={s.brandTagline}>
            Create, edit, and collaborate on documents — all in one place.
          </p>

          <div className={s.features}>
            {[
              "Rich-text editing with formatting",
              "Import .txt, .md and .docx files",
              "Share documents with teammates",
              "Export to PDF in one click",
            ].map((f) => (
              <div key={f} className={s.featureItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────── */}
      <div className={s.formPanel}>
        <div className={s.card}>

          {/* Tabs */}
          <div className={s.tabs}>
            <button
              className={`${s.tab} ${mode === "login" ? s.tabActive : ""}`}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>
            <button
              className={`${s.tab} ${mode === "signup" ? s.tabActive : ""}`}
              onClick={() => switchMode("signup")}
            >
              Create Account
            </button>
          </div>

          {/* Notice */}
          <p className={s.notice}>
            {mode === "login"
              ? "Any email and password works — no real auth required."
              : "Pick any email, name, and password to get started."}
          </p>

          {/* Fields */}
          <div className={s.fields}>
            {mode === "signup" && (
              <div className={s.field}>
                <label className={s.label}>Display Name</label>
                <input
                  className={s.input}
                  type="text"
                  placeholder="e.g. Alice"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
              </div>
            )}

            <div className={s.field}>
              <label className={s.label}>Email</label>
              <input
                className={s.input}
                type="text"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus={mode === "login"}
              />
            </div>

            <div className={s.field}>
              <label className={s.label}>Password</label>
              <input
                className={s.input}
                type="password"
                placeholder="anything works"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className={s.error}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className={s.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "Please wait…"
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>

          {/* Demo users */}
          <div className={s.seedSection}>
            <p className={s.seedLabel}>Or sign in as a demo user:</p>
            <div className={s.seedList}>
              {seedUsers.map((email) => (
                <button
                  key={email}
                  className={s.seedBtn}
                  onClick={() => quickFill(email)}
                >
                  {email.split("@")[0]}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
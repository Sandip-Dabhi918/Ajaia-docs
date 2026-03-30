import type { Metadata } from "next"
import "./globals.css"
import { AuthProvider } from "../lib/auth"

export const metadata: Metadata = {
  title: "Ajaia Docs",
  description: "Lightweight collaborative document editor",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
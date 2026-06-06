import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/lib/theme"

export const metadata: Metadata = {
  title: "Artificial Wit - Apps",
  description: "Artificial Wit Apps is a collection of AI-powered applications designed to enhance productivity and creativity. Explore our suite of tools, including chatbots, knowledge bases, agents, LLMs, prompts, and more. Experience the future of AI technology with Artificial Wit Apps.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full dark">
      <body className="h-full overflow-hidden">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}

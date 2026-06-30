import type { Metadata } from "next"
import Script from "next/script"
import { headers } from "next/headers"
import "./globals.css"
import { ThemeProvider } from "@/lib/theme"

export const metadata: Metadata = {
  title: "Artificial Wit - Apps",
  description: "Artificial Wit Apps is a collection of AI-powered applications",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" className="h-full dark">
      <body className="h-full overflow-hidden">
        <ThemeProvider>{children}</ThemeProvider>
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" nonce={nonce} />
      </body>
    </html>
  )
}

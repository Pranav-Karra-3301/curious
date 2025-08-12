import type React from "react"
import type { Metadata } from "next"
import { Ubuntu } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"

const ubuntu = Ubuntu({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
  variable: "--font-ubuntu",
})

export const metadata: Metadata = {
  title: "Something to think about",
  description: "Hourly questions to spark critical thinking",
  metadataBase: new URL('https://curious.pranavkarra.me'),
  openGraph: {
    title: "Something to think about",
    description: "Hourly questions to spark critical thinking",
    url: "https://curious.pranavkarra.me",
    siteName: "Curious",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Current thought-provoking question",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Something to think about",
    description: "Hourly questions to spark critical thinking",
    images: ["/api/og"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={ubuntu.variable}>
      <body className="font-ubuntu antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}

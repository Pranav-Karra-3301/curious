import type React from "react"
import type { Metadata } from "next"
import { Ubuntu } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
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
  description: "Daily questions to spark critical thinking - like Wordle for your thoughts",
  metadataBase: new URL('https://curious.pranavkarra.me'),
  applicationName: "Curious",
  authors: [{ name: "Pranav Karra", url: "https://pranavkarra.me" }],
  creator: "Pranav Karra",
  publisher: "Pranav Karra",
  keywords: [
    "daily question",
    "thought-provoking question",
    "critical thinking",
    "mental gym",
    "question of the day",
    "curious",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Something to think about",
    description: "Daily questions to spark critical thinking - like Wordle for your thoughts",
    url: "https://curious.pranavkarra.me",
    siteName: "Curious",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Today's thought-provoking question",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Something to think about",
    description: "Daily questions to spark critical thinking - like Wordle for your thoughts",
    images: ["/api/og"],
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://pranavkarra.me/#person",
      name: "Pranav Karra",
      url: "https://pranavkarra.me",
    },
    {
      "@type": "WebSite",
      "@id": "https://curious.pranavkarra.me/#website",
      url: "https://curious.pranavkarra.me",
      name: "Curious",
      description:
        "Daily questions to spark critical thinking - like Wordle for your thoughts",
      inLanguage: "en-US",
      creator: { "@id": "https://pranavkarra.me/#person" },
    },
    {
      "@type": "WebApplication",
      "@id": "https://curious.pranavkarra.me/#webapp",
      url: "https://curious.pranavkarra.me",
      name: "Curious",
      description:
        "A daily thought-provoking question to keep your mind sharp. One curious question every day at midnight EST.",
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires JavaScript.",
      isPartOf: { "@id": "https://curious.pranavkarra.me/#website" },
      creator: { "@id": "https://pranavkarra.me/#person" },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={ubuntu.variable}>
      <body className="font-ubuntu antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}

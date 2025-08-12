import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

// Fallback questions for when AI is not available
const fallbackQuestions = [
  "What assumptions about the world do you hold that you've never questioned?",
  "If you could know the exact date of your death, would you want to?",
  "Is it possible to be truly objective about anything you personally experience?",
  "What would happen to your sense of self if all your memories were gradually replaced?",
  "Do you think free will exists, or are we just very complex biological machines?",
  "If consciousness could be transferred to a machine, would it still be you?",
  "What makes something morally right or wrong beyond cultural agreement?",
  "Is there a difference between existing and being perceived to exist?",
  "What would you do if you discovered your entire life was a simulation?",
  "Can you ever truly know another person, or only your interpretation of them?",
]

const getCurrentQuestionIndex = () => {
  const now = new Date()
  const hoursSinceEpoch = Math.floor(now.getTime() / (1000 * 60 * 60))
  return hoursSinceEpoch % fallbackQuestions.length
}

export async function GET(request: NextRequest) {
  try {
    // Get current question based on hour
    const questionIndex = getCurrentQuestionIndex()
    const currentQuestion = fallbackQuestions[questionIndex]

    // Detect if user prefers dark mode (simplified approach)
    const userAgent = request.headers.get("user-agent") || ""
    const isDark = userAgent.includes("Dark") || Math.random() > 0.5 // Fallback to random

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "#2d2520" : "#f5f1eb",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: "32px",
            fontWeight: "bold",
            color: isDark ? "#d4c4a8" : "#8b6f47",
            marginBottom: "40px",
            textAlign: "center",
          }}
        >
          Something to think about
        </div>
        <div
          style={{
            fontSize: "48px",
            fontWeight: "bold",
            color: isDark ? "#f5f1eb" : "#3a2f26",
            textAlign: "center",
            lineHeight: "1.2",
            maxWidth: "900px",
          }}
        >
          {currentQuestion}
        </div>
        <div
          style={{
            fontSize: "24px",
            color: isDark ? "#a08b73" : "#8b6f47",
            marginTop: "60px",
            textAlign: "center",
          }}
        >
          everyhour.vercel.app
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (e: any) {
    console.log(`${e.message}`)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}

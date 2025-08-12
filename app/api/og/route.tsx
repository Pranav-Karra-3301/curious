import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"

export const runtime = "edge"

// Fallback questions for when API is not available
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

async function getCurrentQuestion(): Promise<string> {
  try {
    // Fetch the current question from our API endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000'
    
    const response = await fetch(`${baseUrl}/api/generate-question`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout for OG image generation
      signal: AbortSignal.timeout(3000),
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.question) {
        return data.question
      }
    }
  } catch (error) {
    console.error('Error fetching question for OG image:', error)
  }
  
  // Fallback to a deterministic question based on hour if API fails
  const index = Math.floor(Date.now() / (1000 * 60 * 60)) % fallbackQuestions.length
  return fallbackQuestions[index]
}

export async function GET(request: NextRequest) {
  try {
    // Get current question from API or fallback
    const currentQuestion = await getCurrentQuestion()

    // Detect if user prefers dark mode
    const userAgent = request.headers.get("user-agent") || ""
    const isDark = userAgent.includes("Dark")

    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? "#2a2520" : "#f7f5f0",
          padding: "80px",
          position: "relative",
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: isDark 
              ? "radial-gradient(ellipse at center, transparent 0%, rgba(42, 37, 32, 0.4) 100%)"
              : "radial-gradient(ellipse at center, transparent 0%, rgba(247, 245, 240, 0.4) 100%)",
            pointerEvents: "none",
          }}
        />
        
        {/* Title */}
        <div
          style={{
            fontSize: "24px",
            fontWeight: "300",
            letterSpacing: "0.1em",
            color: isDark ? "#a69885" : "#a69885",
            marginBottom: "48px",
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          Something to think about
        </div>
        
        {/* Question */}
        <div
          style={{
            fontSize: currentQuestion.length > 100 ? "42px" : "48px",
            fontWeight: "600",
            color: isDark ? "#e8e2d5" : "#3a3a3a",
            textAlign: "center",
            lineHeight: "1.4",
            maxWidth: "1000px",
            letterSpacing: "-0.02em",
          }}
        >
          {currentQuestion}
        </div>
        
        {/* Bottom section */}
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "18px",
              color: isDark ? "#6b5d4a" : "#a69885",
              textAlign: "center",
            }}
          >
            new question every hour
          </div>
          <div
            style={{
              fontSize: "20px",
              color: isDark ? "#8b7355" : "#8b7355",
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            curious.pranavkarra.me
          </div>
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  } catch (e: any) {
    console.log(`Error generating OG image: ${e.message}`)
    
    // Return a simple fallback image
    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f7f5f0",
          padding: "80px",
        }}
      >
        <div
          style={{
            fontSize: "48px",
            fontWeight: "600",
            color: "#3a3a3a",
            textAlign: "center",
          }}
        >
          Something to think about
        </div>
        <div
          style={{
            fontSize: "20px",
            color: "#a69885",
            marginTop: "24px",
          }}
        >
          curious.pranavkarra.me
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    )
  }
}
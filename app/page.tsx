"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

interface Question {
  text: string
  timestamp: number
}

export default function QuestionSite() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [displayedText, setDisplayedText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isUntyping, setIsUntyping] = useState(false)
  const [timeUntilNext, setTimeUntilNext] = useState("")
  const [showCursor, setShowCursor] = useState(true)
  const [showProgressBars, setShowProgressBars] = useState(false)
  const [lastFetchedHour, setLastFetchedHour] = useState<number | null>(null)
  const [pendingQuestion, setPendingQuestion] = useState<Question | null>(null)

  const getCurrentHourTimestamp = () => {
    const now = new Date()
    const currentHour = new Date(now)
    currentHour.setMinutes(0, 0, 0)
    return currentHour.getTime()
  }

  const getTimeUntilNextHour = () => {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)
    return nextHour.getTime() - now.getTime()
  }

  const triggerPreGeneration = useCallback(async () => {
    try {
      const response = await fetch('/api/pre-generate', {
        method: 'GET',
        cache: 'no-cache'
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Pre-generation result:', data.status)
      }
    } catch (error) {
      console.error('Pre-generation failed:', error)
    }
  }, [])

  const fetchQuestion = useCallback(async () => {
    const currentHour = getCurrentHourTimestamp()
    
    // Only fetch if we haven't fetched for this hour yet
    if (lastFetchedHour === currentHour) {
      return
    }

    try {
      const response = await fetch('/api/generate-question', {
        method: 'GET',
        cache: 'no-cache' // Ensure we get fresh data
      })

      if (!response.ok) {
        throw new Error('Failed to fetch question')
      }

      const data = await response.json()
      
      console.log(`Fetched question for hour: ${new Date(currentHour).toISOString()}`, data.source)
      
      const newQuestion = {
        text: data.question,
        timestamp: data.hourTimestamp || currentHour
      }
      
      // If this is a new hour and we have a current question, trigger smooth transition
      if (currentQuestion && lastFetchedHour && lastFetchedHour !== currentHour) {
        setPendingQuestion(newQuestion)
        setIsUntyping(true)
      } else {
        setCurrentQuestion(newQuestion)
      }
      
      setLastFetchedHour(currentHour)
    } catch (error) {
      console.error('Error fetching question:', error)
      // In case of error, try again in 5 seconds
      setTimeout(fetchQuestion, 5000)
    }
  }, [lastFetchedHour, currentQuestion])

  // Untyping animation effect
  useEffect(() => {
    if (!isUntyping || !currentQuestion) return

    let index = displayedText.length
    const untypeInterval = setInterval(() => {
      if (index > 0) {
        setDisplayedText(currentQuestion.text.slice(0, index - 1))
        index--
      } else {
        setIsUntyping(false)
        clearInterval(untypeInterval)
        // Switch to pending question after untyping is complete
        if (pendingQuestion) {
          setCurrentQuestion(pendingQuestion)
          setPendingQuestion(null)
        }
      }
    }, 30) // 30ms per character for smooth untyping

    return () => clearInterval(untypeInterval)
  }, [isUntyping, currentQuestion, displayedText.length, pendingQuestion])

  // Typing animation effect
  useEffect(() => {
    if (!currentQuestion || isUntyping) return

    setIsTyping(true)
    setDisplayedText("")

    const text = currentQuestion.text
    let index = 0

    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        setIsTyping(false)
        clearInterval(typeInterval)
      }
    }, 50) // 50ms per character for smooth typing

    return () => clearInterval(typeInterval)
  }, [currentQuestion, isUntyping])

  // Cursor blink effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 1000) // Blink every second

    return () => clearInterval(blinkInterval)
  }, [])

  // Timer and question fetching logic
  useEffect(() => {
    let timer: NodeJS.Timeout

    const updateTimer = () => {
      const timeLeft = getTimeUntilNextHour()
      const currentHour = getCurrentHourTimestamp()

      // Check if we need to fetch a new question (new hour started)
      if (lastFetchedHour !== currentHour) {
        fetchQuestion()
      }

      // Update countdown
      const minutes = Math.floor(timeLeft / (60 * 1000))
      const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000)
      setTimeUntilNext(`${minutes}:${seconds.toString().padStart(2, "0")}`)

      // Trigger pre-generation 5 minutes before the hour
      if (minutes === 4 && seconds >= 55 && seconds <= 59) {
        triggerPreGeneration()
      }

      // If we're within 2 seconds of the next hour, prepare to fetch
      if (timeLeft <= 2000) {
        // Set a timeout to fetch the new question right when the hour changes
        setTimeout(() => {
          setLastFetchedHour(null) // Reset to force fetch
          fetchQuestion()
        }, timeLeft + 100) // Add 100ms buffer to ensure we're in the new hour
      }
    }

    // Initial fetch
    fetchQuestion()

    // Start the timer
    updateTimer()
    timer = setInterval(updateTimer, 1000)

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [fetchQuestion, lastFetchedHour, triggerPreGeneration])

  // Progress bar calculations
  const getYearProgress = () => {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1)
    const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    const daysPassed = (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
    return Math.floor((daysPassed / totalDays) * 100)
  }

  const getMonthProgress = () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const totalDays = (endOfMonth.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)
    const daysPassed = (now.getTime() - startOfMonth.getTime()) / (1000 * 60 * 60 * 24)
    return Math.floor((daysPassed / totalDays) * 100)
  }

  // Handle window resize for progress bars
  useEffect(() => {
    const checkHeight = () => {
      setShowProgressBars(window.innerHeight >= 600 && window.innerWidth >= 768)
    }

    checkHeight()
    window.addEventListener("resize", checkHeight)
    return () => window.removeEventListener("resize", checkHeight)
  }, [])

  const yearProgress = getYearProgress()
  const monthProgress = getMonthProgress()

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 md:p-6 relative"
      style={{ backgroundColor: "var(--color-cream)" }}
    >
      {showProgressBars && (
        <div className="fixed left-4 top-1/2 transform -translate-y-1/2 hidden md:block">
          <div className="flex flex-col space-y-1">
            {Array.from({ length: 20 }, (_, i) => {
              const segmentProgress = (yearProgress / 100) * 20
              const isFilled = i < Math.floor(segmentProgress)
              return (
                <div key={i} className="relative group">
                  <div className="absolute inset-0 w-8 h-6 -translate-x-3 -translate-y-1 cursor-pointer" />
                  <div
                    className="w-1 h-3 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: isFilled ? "var(--color-dark-brown)" : "var(--color-muted-brown)",
                      opacity: isFilled ? 1 : 0.3,
                    }}
                  />
                  <div className="absolute left-6 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                    {isFilled ? `${yearProgress}% సంవత్సరం పూర్తయింది` : `${100 - yearProgress}% సంవత్సరం మిగిలి ఉంది`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showProgressBars && (
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 hidden md:block">
          <div className="flex flex-col space-y-1">
            {Array.from({ length: 20 }, (_, i) => {
              const segmentProgress = (monthProgress / 100) * 20
              const isFilled = i < Math.floor(segmentProgress)
              return (
                <div key={i} className="relative group">
                  <div className="absolute inset-0 w-8 h-6 translate-x-3 -translate-y-1 cursor-pointer" />
                  <div
                    className="w-1 h-3 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: isFilled ? "var(--color-dark-brown)" : "var(--color-muted-brown)",
                      opacity: isFilled ? 1 : 0.3,
                    }}
                  />
                  <div className="absolute right-6 top-1/2 transform -translate-y-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-10">
                    {isFilled ? `${monthProgress}% నెల పూర్తయింది` : `${100 - monthProgress}% నెల మిగిలి ఉంది`}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="max-w-2xl w-full text-center space-y-6 md:space-y-8 fade-in">
        {/* Main question with typing animation */}
        <div className="space-y-4">
          <div
            className="text-xl sm:text-2xl md:text-3xl font-bold leading-relaxed min-h-[3rem] sm:min-h-[4rem] flex items-center justify-center px-2"
            style={{ color: "var(--color-charcoal)" }}
          >
            <span className="inline-block">
              {displayedText}
              {(isTyping || isUntyping || !currentQuestion) && (
                <span
                  className={`ml-1 inline-block w-1 h-6 sm:h-8 rounded-full transition-opacity duration-100 ${
                    showCursor ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ backgroundColor: "var(--color-dark-brown)" }}
                />
              )}
            </span>
          </div>
        </div>

        {/* Timer */}
        {timeUntilNext && (
          <div className="space-y-2">
            <div className="text-sm font-light tracking-wide" style={{ color: "var(--color-muted-brown)" }}>
              తదుపరి ప్రశ్న
            </div>
            <div className="text-lg font-mono" style={{ color: "var(--color-dark-brown)" }}>
              {timeUntilNext}
            </div>
          </div>
        )}

        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
          <Link
            href="/about"
            className="text-xs underline hover:no-underline transition-all duration-200"
            style={{ color: "var(--color-muted-brown)" }}
          >
            ఇది ఏమిటి
          </Link>
          <span className="text-xs" style={{ color: "var(--color-muted-brown)" }}>·</span>
          <a
            href="https://pranavkarra.me"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline hover:no-underline transition-all duration-200"
            style={{ color: "var(--color-muted-brown)" }}
          >
            pranavkarra.me
          </a>
        </div>
      </div>
    </div>
  )
}
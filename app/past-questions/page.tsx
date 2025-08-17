"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

interface PastQuestion {
  id: string
  question: string
  used_at: string
}

export default function PastQuestionsPage() {
  const [questions, setQuestions] = useState<PastQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPastQuestions()
  }, [])

  const fetchPastQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('id, question, used_at')
        .not('used_at', 'is', null)
        .eq('is_current', false)
        .order('used_at', { ascending: false })

      if (error) {
        throw error
      }

      setQuestions(data || [])
    } catch (err) {
      console.error('Error fetching past questions:', err)
      setError('Failed to load past questions')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'America/New_York'
    }
    
    return date.toLocaleDateString('en-US', options)
  }

  const groupQuestionsByMonth = (questions: PastQuestion[]) => {
    const grouped: { [key: string]: PastQuestion[] } = {}
    
    questions.forEach(q => {
      const date = new Date(q.used_at)
      // Use Eastern Time for consistent grouping
      const monthYear = date.toLocaleString('en-US', { 
        month: 'long', 
        year: 'numeric',
        timeZone: 'America/New_York'
      })
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = []
      }
      grouped[monthYear].push(q)
    })
    
    return grouped
  }

  const groupedQuestions = groupQuestionsByMonth(questions)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 md:p-6"
      style={{ backgroundColor: "var(--color-cream)" }}
    >
      <div className="max-w-3xl w-full space-y-8 fade-in">
        {/* Logo */}
        <div className="w-full flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Curious logo"
            className="block"
            style={{ width: "100px", height: "100px", objectFit: "contain" }}
          />
        </div>

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm hover:opacity-70 transition-opacity"
            style={{ color: "var(--color-dark-brown)" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            back to today's question
          </Link>
        </div>

        {/* Title */}
        <h1
          className="text-2xl md:text-3xl font-bold text-center"
          style={{ color: "var(--color-charcoal)" }}
        >
          past questions
        </h1>

        {/* Content */}
        <div className="space-y-8">
          {isLoading ? (
            <div className="text-center py-8" style={{ color: "var(--color-muted-brown)" }}>
              loading past questions...
            </div>
          ) : error ? (
            <div className="text-center py-8" style={{ color: "var(--color-muted-brown)" }}>
              {error}
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-8" style={{ color: "var(--color-muted-brown)" }}>
              no past questions yet. check back tomorrow!
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedQuestions).map(([month, monthQuestions]) => (
                <div key={month} className="space-y-4">
                  <h2 
                    className="text-lg font-semibold"
                    style={{ color: "var(--color-dark-brown)" }}
                  >
                    {month}
                  </h2>
                  <div 
                    className="border-l-2 pl-4 space-y-4"
                    style={{ borderColor: "var(--color-soft-brown)" }}
                  >
                    {monthQuestions.map((q) => (
                      <div key={q.id} className="space-y-1">
                        <div 
                          className="text-xs uppercase tracking-wider"
                          style={{ color: "var(--color-muted-brown)" }}
                        >
                          {formatDate(q.used_at)}
                        </div>
                        <div 
                          className="text-base md:text-lg"
                          style={{ color: "var(--color-charcoal)" }}
                        >
                          {q.question}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer links */}
        <div className="flex justify-center gap-6 text-sm pt-8">
          <Link
            href="/about"
            className="underline hover:no-underline transition-all"
            style={{ color: "var(--color-muted-brown)" }}
          >
            what is this
          </Link>
          <a
            href="https://github.com/Pranav-Karra-3301/curious"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline transition-all"
            style={{ color: "var(--color-muted-brown)" }}
          >
            source code
          </a>
          <a
            href="https://pranavkarra.me"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline transition-all"
            style={{ color: "var(--color-muted-brown)" }}
          >
            pranavkarra.me
          </a>
        </div>
      </div>
    </div>
  )
}
"use client"

import { useEffect, useState } from "react"

interface StatusData {
  openai: 'working' | 'fallback' | 'error'
  supabase: 'working' | 'fallback' | 'error'
}

interface StatusDotProps {
  status: 'working' | 'fallback' | 'error'
  label: string
}

function StatusDot({ status, label }: StatusDotProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'working':
        return '#22c55e' // green
      case 'fallback':
        return '#eab308' // yellow
      case 'error':
        return '#ef4444' // red
    }
  }
  
  const getStatusText = () => {
    switch (status) {
      case 'working':
        return 'Operational'
      case 'fallback':
        return 'Using fallback'
      case 'error':
        return 'Error'
    }
  }
  
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div 
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ 
            backgroundColor: getStatusColor(),
            boxShadow: `0 0 0 0 ${getStatusColor()}`,
            animation: 'pulse-glow 2s infinite'
          }}
        />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium" style={{ color: "var(--color-charcoal)" }}>
          {label}
        </span>
        <span className="text-xs" style={{ color: "var(--color-muted-brown)" }}>
          {getStatusText()}
        </span>
      </div>
    </div>
  )
}

export default function StatusIndicator() {
  const [status, setStatus] = useState<StatusData>({
    openai: 'working',
    supabase: 'working'
  })
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/status', {
          cache: 'no-cache'
        })
        
        if (response.ok) {
          const data = await response.json()
          setStatus(data)
        }
      } catch (error) {
        console.error('Failed to fetch status:', error)
        setStatus({
          openai: 'error',
          supabase: 'error'
        })
      } finally {
        setLoading(false)
      }
    }
    
    // Initial check
    checkStatus()
    
    // Check every 30 seconds
    const interval = setInterval(checkStatus, 30000)
    
    return () => clearInterval(interval)
  }, [])
  
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-sm font-medium" style={{ color: "var(--color-charcoal)" }}>
          System Status
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-gray-300 animate-pulse" />
            <span className="text-sm" style={{ color: "var(--color-muted-brown)" }}>
              Checking...
            </span>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-medium" style={{ color: "var(--color-charcoal)" }}>
        System Status
      </div>
      <div className="flex flex-col gap-3">
        <StatusDot status={status.openai} label="OpenAI API" />
        <StatusDot status={status.supabase} label="Supabase Database" />
      </div>
    </div>
  )
}
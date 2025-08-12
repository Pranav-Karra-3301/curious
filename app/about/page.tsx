import Link from "next/link"
import StatusIndicator from "@/components/StatusIndicator"

export default function AboutPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 md:p-6"
      style={{ backgroundColor: "var(--color-cream)" }}
    >
      <div className="max-w-2xl w-full space-y-8 fade-in">
        {/* Back to question link */}
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
            back to the question
          </Link>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          <h1
            className="text-2xl md:text-3xl font-bold text-center"
            style={{ color: "var(--color-charcoal)" }}
          >
            what is this?
          </h1>

          <div
            className="space-y-4 text-base md:text-lg leading-relaxed"
            style={{ color: "var(--color-charcoal)" }}
          >
            <p>
              i was having a conversation with a friend about how machines took over manual labor, so we invented gyms - 
              places where we voluntarily go to lift heavy things and run on treadmills, basically doing the physical work 
              our ancestors did for survival.
            </p>

            <p>
              and now ai is taking over mental labor. so maybe we'll need mental gyms - places or services where we 
              deliberately avoid ai and force ourselves to think manually, to keep our cognitive muscles from atrophying.
            </p>

            <p>
              that conversation inspired me to make this site. it's a simple mental gym - just one curious question 
              every hour, forever. no algorithms, no personalization, no engagement metrics. everyone sees the same 
              question at the same time. just something to think about while you're waiting for the coffee to brew 
              or sitting on the train.
            </p>

            <p className="text-sm" style={{ color: "var(--color-muted-brown)" }}>
              questions are generated using <span className="font-mono">gpt-5-nano-2025-08-07</span>
            </p>
          </div>
        </div>

        {/* Status section */}
        <div className="pt-6 border-t" style={{ borderColor: "var(--color-soft-brown)" }}>
          <StatusIndicator />
        </div>

        {/* Footer links */}
        <div className="flex justify-center gap-6 text-sm">
          <a
            href="https://github.com/pranavkannepalli/curious"
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
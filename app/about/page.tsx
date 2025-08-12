import Link from "next/link"
import StatusIndicator from "@/components/StatusIndicator"

export default function AboutPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8 md:p-6"
      style={{ backgroundColor: "var(--color-cream)" }}
    >
      <div className="max-w-2xl w-full space-y-8 fade-in">
        {/* Logo */}
        <div className="w-full flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Curious logo"
            className="block"
            style={{ width: "120px", height: "120px", objectFit: "contain" }}
          />
        </div>
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
            ప్రశ్నకు తిరిగి వెళ్ళు
          </Link>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          <h1
            className="text-2xl md:text-3xl font-bold text-center"
            style={{ color: "var(--color-charcoal)" }}
          >
            ఇది ఏమిటి?
          </h1>

          <div
            className="space-y-4 text-base md:text-lg leading-relaxed"
            style={{ color: "var(--color-charcoal)" }}
          >
            <p>
              నేను ఒక స్నేహితుడితో మాట్లాడుతున్నాను - యంత్రాలు శారీరక శ్రమను తీసుకున్నాయి కాబట్టి మనం జిమ్‌లను కనుగొన్నాము - 
              మనం స్వచ్ఛందంగా భారమైన వస్తువులను ఎత్తడానికి మరియు ట్రెడ్‌మిల్‌లపై పరుగెత్తడానికి వెళ్ళే స్థలాలు, అవసరంగా మన పూర్వీకులు 
              చేసిన శారీరక పనిని చేస్తున్నాము.
            </p>

            <p>
              ఇప్పుడు AI మానసిక శ్రమను తీసుకుంటోంది. కాబట్టి మనకు మానసిక జిమ్‌లు అవసరం కావచ్చు - మనం 
              ఉద్దేశపూర్వకంగా AIని నివారించి మానవీయంగా ఆలోచించుకునే స్థలాలు లేదా సేవలు, మన జ్ఞాన కండరాలు క్షీణించకుండా ఉంచడానికి.
            </p>

            <p>
              ఆ సంభాషణ నాకు ఈ సైట్ చేయడానికి ప్రేరణ ఇచ్చింది. ఇది ఒక సాధారణ మానసిక జిమ్ - ప్రతి గంటకు ఒక ఆసక్తికరమైన ప్రశ్న, 
              ఎప్పటికీ. అల్గారిథమ్‌లు లేవు, వ్యక్తిగతీకరణ లేదు, ఎంగేజ్‌మెంట్ మెట్రిక్స్ లేవు. అందరూ అదే సమయంలో 
              అదే ప్రశ్నను చూస్తారు. కాఫీ కోసం వేచి ఉన్నప్పుడు లేదా రైలులో కూర్చున్నప్పుడు 
              ఆలోచించడానికి ఏదో ఒకటి.
              
              నా అమ్మమ్మకు షేర్ చేయడానికి నేను ఈ తెలుగు వెర్షన్ చేశాను 😊
            </p>

            <p className="text-sm" style={{ color: "var(--color-muted-brown)" }}>
              ప్రశ్నలు <span className="font-mono">gpt-5-nano-2025-08-07</span> ఉపయోగించి సృష్టించబడతాయి
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
            href="https://github.com/Pranav-Karra-3301/curious"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline transition-all"
            style={{ color: "var(--color-muted-brown)" }}
          >
            సోర్స్ కోడ్
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
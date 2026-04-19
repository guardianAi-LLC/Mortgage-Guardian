import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Mortgage Guardian — AI-Powered Mortgage Audit'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              color: 'white',
              fontWeight: 700,
            }}
          >
            MG
          </div>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: 'white',
              letterSpacing: '-0.02em',
            }}
          >
            Mortgage Guardian
          </span>
        </div>
        <span
          style={{
            fontSize: '24px',
            color: '#94a3b8',
            maxWidth: '600px',
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          AI-powered forensic audit that detects mortgage servicer violations and generates legal documents.
        </span>
      </div>
    ),
    { ...size }
  )
}

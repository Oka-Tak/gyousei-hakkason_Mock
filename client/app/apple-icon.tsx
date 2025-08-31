import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}

export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 80,
          background: 'linear-gradient(135deg, #07796b 0%, #0a9a89 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          borderRadius: '20px',
          fontFamily: 'system-ui',
          boxShadow: '0 8px 32px rgba(7, 121, 107, 0.3)',
        }}
      >
        Z
      </div>
    ),
    {
      ...size,
    }
  )
}
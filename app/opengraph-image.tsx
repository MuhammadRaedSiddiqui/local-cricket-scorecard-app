import { ImageResponse } from 'next/og';

export const alt = 'CrickLive - Bring local cricket online';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', background: '#052e16', color: '#f0fdf4' }}>
      <div style={{ display: 'flex', fontSize: 32, color: '#86efac', marginBottom: 36 }}>CRICKLIVE</div>
      <div style={{ display: 'flex', fontSize: 76, fontWeight: 700 }}>Bring local cricket online.</div>
      <div style={{ display: 'flex', fontSize: 30, marginTop: 36, color: '#bbf7d0' }}>Ball-by-ball scoring. Live scorecards. League leaderboards.</div>
    </div>,
    size,
  );
}

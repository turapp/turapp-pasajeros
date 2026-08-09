'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--bg)', color: 'var(--tx)', fontFamily: 'Manrope, sans-serif' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--redS)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <div style={{ font: '800 24px/1.2 Manrope,sans-serif', letterSpacing: '-0.03em', textAlign: 'center', marginBottom: '12px' }}>
        Algo salió mal
      </div>
      <div style={{ font: '500 15px/1.5 Manrope,sans-serif', color: 'var(--mu)', textAlign: 'center', marginBottom: '32px', maxWidth: '300px' }}>
        {error?.message || 'Ocurrió un error inesperado. Intenta de nuevo.'}
      </div>
      <button
        onClick={reset}
        style={{ height: '52px', padding: '0 32px', borderRadius: '14px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 16px Manrope,sans-serif', border: 'none', cursor: 'pointer' }}
      >
        Reintentar
      </button>
    </div>
  );
}

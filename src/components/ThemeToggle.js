'use client';

// ============================================================
// TOGGLE DE TEMA
// ============================================================
// Visible pero fuera del camino. El anterior medía 30px con opacidad .55:
// se perdía contra el fondo y nadie lo encontraba.
//
// Decisiones: iconos SVG en vez de emoji (los emoji se ven distintos en cada
// teléfono y rompen la consistencia), fondo sólido con sombra para que se lea
// como control y no como decoración, y 38px — el mínimo cómodo para el pulgar
// sin invadir la pantalla.
//
// Se esconde solo en pantallas de mapa a pantalla completa, donde taparía
// controles del mapa.

export default function ThemeToggle({ theme, onToggle, ocultar = false }) {
  if (ocultar) return null;
  const oscuro = theme === 'dark';

  return (
    <button
      onClick={onToggle}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      style={{
        // absolute, NO fixed: #iphone-wrapper tiene un transform, y un
        // ancestro con transform vuelve 'fixed' relativo a ÉL en vez de a la
        // ventana — el botón terminaba fuera de la pantalla.
        position: 'absolute', top: '12px', right: '12px', zIndex: 99999,
        width: '38px', height: '38px', borderRadius: '50%',
        background: 'var(--bg)', border: '1px solid var(--bd2)',
        boxShadow: '0 2px 10px rgba(0,0,0,.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
        transition: 'transform .15s ease, box-shadow .15s ease',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(.92)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
    >
      {oscuro ? (
        // Sol: se muestra en modo oscuro porque es a lo que se cambia
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  );
}

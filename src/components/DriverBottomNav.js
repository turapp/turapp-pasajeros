'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function DriverBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    {
      name: 'Manejar',
      path: '/driver',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-5l5 2.5-5 2.5z"/> // Dummy icon for 'Manejar' (driving wheel roughly) - using simple car steering
          ) : (
             <circle cx="12" cy="12" r="9" />
          )}
        </svg>
      )
    },
    {
      name: 'Ganancias',
      path: '/driver/earnings',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
             <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zM16.2 13H19v6h-2.8z"/>
          ) : (
             <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zM16.2 13H19v6h-2.8z"/>
          )}
        </svg>
      )
    },
    {
      name: 'Historial',
      path: '/driver/history',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 11V7h1.5v3.4l4.5 4.5-.8.8z"/>
          ) : (
             <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 11V7h1.5v3.4l4.5 4.5-.8.8z"/>
          )}
        </svg>
      )
    },
    {
      name: 'Desempeño',
      path: '/driver/performance',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
             <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          ) : (
             <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="none" stroke="currentColor"/>
          )}
        </svg>
      )
    },
    {
      name: 'Perfil',
      path: '/driver/account',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          ) : (
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="none" stroke="currentColor"/>
          )}
        </svg>
      )
    }
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '390px',
      height: '80px',
      background: '#fff',
      borderTop: '1px solid #eaeae8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 8px',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)'
    }}>
      {tabs.map((t) => {
        const isActive = pathname === t.path;
        return (
          <button
            key={t.name}
            onClick={() => router.push(t.path)}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              color: isActive ? '#111' : '#aaa',
              transition: 'color 0.2s ease',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            {/* The icon in the mockup has a specific styling, but we'll use SVG for now */}
            {t.icon(isActive)}
            <span style={{ font: '600 10px Manrope,sans-serif' }}>
              {t.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

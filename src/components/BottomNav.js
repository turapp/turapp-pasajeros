'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    {
      name: 'Home',
      path: '/home',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
            <path d="M12 3l9 7v11a1 1 0 01-1 1H4a1 1 0 01-1-1V10l9-7zm0 2.5L5.5 10v9.5h13V10L12 5.5z"/>
          ) : (
            <path d="M12 3.5l8.5 6.5v10.5h-5v-6h-7v6h-5v-10.5L12 3.5z" strokeLinecap="round" strokeLinejoin="round"/>
          )}
        </svg>
      )
    },
    {
      name: 'Services',
      path: '/services',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
             <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
          ) : (
             <>
               <rect x="4" y="4" width="6" height="6" rx="1" />
               <rect x="14" y="4" width="6" height="6" rx="1" />
               <rect x="4" y="14" width="6" height="6" rx="1" />
               <rect x="14" y="14" width="6" height="6" rx="1" />
             </>
          )}
        </svg>
      )
    },
    {
      name: 'Activity',
      path: '/activity',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H7v-2h5v2zm4-4H7v-2h9v2zm0-4H7V7h9v2z"/>
          ) : (
             <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zM5 5v14h14V5H5zm2 10h6v2H7v-2zm0-4h10v2H7v-2zm0-4h10v2H7V7z" fill="currentColor" stroke="none" />
          )}
        </svg>
      )
    },
    {
      name: 'Perfil',
      path: '/account',
      icon: (active) => (
        <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"}>
          {active ? (
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          ) : (
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 8c-2.67 0-8 1.34-8 4v.5h16V18c0-2.66-5.33-4-8-4zm-6 2.5c1.22-.85 3.31-1.5 6-1.5s4.78.65 6 1.5H6z" fill="currentColor" stroke="none"/>
          )}
        </svg>
      )
    }
  ];

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '80px', background: 'var(--bg)', borderTop: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 100, paddingBottom: '10px', transition: 'background 0.3s ease, border 0.3s ease' }}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        return (
          <button 
            key={tab.name}
            onClick={() => router.push(tab.path)}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '4px',
              padding: isActive ? '8px 16px' : '8px 12px',
              borderRadius: '99px',
              background: isActive ? 'var(--sf)' : 'transparent',
              color: isActive ? 'var(--tx)' : 'var(--mu)',
              transition: 'all 0.2s ease',
              width: '76px'
            }}
          >
            {tab.icon(isActive)}
            <span style={{ font: '600 10.5px Manrope,sans-serif', letterSpacing: '-0.02em', marginTop: '2px' }}>{tab.name}</span>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [lang, setLang] = useState('es');

  useEffect(() => {
    // Optionally load preferences from localStorage
    const savedTheme = localStorage.getItem('turapp_theme') || 'light';
    const savedLang = localStorage.getItem('turapp_lang') || 'es';
    setTheme(savedTheme);
    setLang(savedLang);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('turapp_theme', newTheme);
  };

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem('turapp_lang', newLang);
  };

  return (
    <AppContext.Provider value={{ theme, toggleTheme, lang, changeLang }}>
      <div className="tr-app" data-theme={theme} style={{ position: 'relative', width: '100%', minHeight: '100vh', overflow: 'hidden', background: 'var(--bg)', color: 'var(--tx)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '390px', height: '100vh', overflow: 'hidden' }}>
          {children}
          
          {/* Global Theme Toggle */}
          <button 
            onClick={toggleTheme}
            style={{ position: 'fixed', bottom: '84px', right: '16px', width: '48px', height: '48px', borderRadius: '50%', background: 'var(--inv)', color: 'var(--invtx)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, boxShadow: 'var(--sh)', transition: 'all 0.3s ease', border: '1px solid var(--bd)' }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}

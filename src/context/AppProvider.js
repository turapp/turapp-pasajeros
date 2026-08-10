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
      {/* height:100vh aqui (en vez de 100dvh) NO coincidía con #iphone-wrapper
          (globals.css), que sí usa 100dvh en el breakpoint móvil — en
          celulares reales, con la barra de direcciones visible, 100vh es
          más alto que el viewport realmente visible. Como cada pantalla
          (step===X en page.js/home/cali) se posiciona con inset:0 relativo
          a este div, quedaban ancladas a una caja más alta de lo visible:
          el contenido del fondo (bottom nav, botones finales) se recortaba
          fuera de la parte visible sin ningún scroll que lo alcanzara. */}
      <div className="tr-app" data-theme={theme} style={{ position: 'relative', width: '100%', minHeight: '100dvh', overflow: 'hidden', background: 'var(--bg)', color: 'var(--tx)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '390px', height: '100dvh', overflow: 'hidden' }}>
          {children}
          
          {/* Global Theme Toggle — discreto, arriba a la derecha, fuera del contenido y de la barra inferior */}
          <button
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            style={{ position: 'fixed', top: '14px', right: '14px', width: '30px', height: '30px', borderRadius: '50%', background: 'var(--sf)', color: 'var(--mu)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, boxShadow: 'none', border: '1px solid var(--bd2)', opacity: 0.55, fontSize: '13px', transition: 'opacity 0.2s ease' }}
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

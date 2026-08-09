'use client';

import React from 'react';

const POS = {
  driver: { left: 52, top: 150, w: 78, h: 88 },
  1: { left: 170, top: 150, w: 78, h: 88 },
  2: { left: 32, top: 284, w: 70, h: 88 },
  3: { left: 115, top: 284, w: 70, h: 88 },
  4: { left: 198, top: 284, w: 70, h: 88 }
};

const STATES = {
  available: { bg: 'var(--bg)', border: '2px solid var(--jade)', tx: 'var(--jade)', badgeBg: 'var(--jadeS)', shadow: '0 3px 12px rgba(0,0,0,.09)' },
  selected: { bg: 'var(--inv)', border: '2px solid var(--inv)', tx: 'var(--invtx)', badgeBg: 'rgba(255,255,255,.18)', shadow: '0 8px 22px rgba(0,0,0,.28)' },
  occupied: { bg: 'var(--redS)', border: '2px solid transparent', tx: 'var(--red)', badgeBg: 'rgba(200,64,47,.16)', shadow: 'none' },
  reserved: { bg: 'var(--amberS)', border: '2px solid transparent', tx: 'var(--amber)', badgeBg: 'rgba(201,138,30,.18)', shadow: 'none' },
  blocked: { bg: 'var(--sf2)', border: '2px solid transparent', tx: 'var(--mu)', badgeBg: 'rgba(0,0,0,.06)', shadow: 'none' }
};

const MARKS = { available: '', selected: '✓', occupied: '', reserved: '', blocked: '' };

export default function TurCaliCar({ seats = [], onSeatSelect, showPlate = true, plate = 'WBD84F', model = 'Renault Duster' }) {
  
  return (
    <div style={{ position: 'relative', width: '300px', height: '452px', margin: '0 auto' }}>
      
      {/* Tires */}
      <div style={{ position: 'absolute', left: '2px', top: '120px', width: '16px', height: '56px', borderRadius: '6px', background: 'var(--tx)', opacity: .82 }}></div>
      <div style={{ position: 'absolute', right: '2px', top: '120px', width: '16px', height: '56px', borderRadius: '6px', background: 'var(--tx)', opacity: .82 }}></div>
      <div style={{ position: 'absolute', left: '2px', top: '318px', width: '16px', height: '56px', borderRadius: '6px', background: 'var(--tx)', opacity: .82 }}></div>
      <div style={{ position: 'absolute', right: '2px', top: '318px', width: '16px', height: '56px', borderRadius: '6px', background: 'var(--tx)', opacity: .82 }}></div>

      {/* Body */}
      <div style={{ position: 'absolute', left: '18px', top: 0, width: '264px', height: '452px', borderRadius: '76px 76px 52px 52px', background: 'linear-gradient(160deg,var(--sf) 0%,var(--sf2) 46%,var(--sf) 100%)', boxShadow: '0 22px 48px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.5)' }}></div>
      <div style={{ position: 'absolute', left: '18px', top: 0, width: '264px', height: '452px', borderRadius: '76px 76px 52px 52px', border: '1.5px solid var(--bd)', pointerEvents: 'none' }}></div>

      {/* Windshields */}
      <div style={{ position: 'absolute', left: '34px', top: '8px', width: '232px', height: '74px', borderRadius: '64px 64px 26px 26px', background: 'var(--bd2)' }}></div>
      <div style={{ position: 'absolute', left: '34px', top: '86px', width: '232px', height: '34px', borderRadius: '34px 34px 10px 10px', background: 'linear-gradient(180deg,rgba(120,150,170,.42),rgba(120,150,170,.18))', border: '1px solid var(--bd2)' }}></div>
      <div style={{ position: 'absolute', left: '34px', top: '394px', width: '232px', height: '30px', borderRadius: '10px 10px 40px 40px', background: 'linear-gradient(0deg,rgba(120,150,170,.36),rgba(120,150,170,.14))', border: '1px solid var(--bd2)' }}></div>

      {/* Details */}
      <div style={{ position: 'absolute', left: '44px', top: '20px', width: '44px', height: '13px', borderRadius: '7px', background: 'var(--tx)', opacity: .5 }}></div>
      <div style={{ position: 'absolute', right: '44px', top: '20px', width: '44px', height: '13px', borderRadius: '7px', background: 'var(--tx)', opacity: .5 }}></div>
      <div style={{ position: 'absolute', left: '6px', top: '96px', width: '26px', height: '14px', borderRadius: '5px', background: 'var(--tx)', opacity: .7 }}></div>
      <div style={{ position: 'absolute', right: '6px', top: '96px', width: '26px', height: '14px', borderRadius: '5px', background: 'var(--tx)', opacity: .7 }}></div>
      <div style={{ position: 'absolute', left: '32px', top: '236px', width: '236px', height: '1.5px', background: 'var(--bd)', opacity: .7 }}></div>

      {/* Driver Seat (Static) */}
      <div style={{ position: 'absolute', left: POS.driver.left + 'px', top: POS.driver.top + 'px', width: POS.driver.w + 'px', height: POS.driver.h + 'px', borderRadius: '16px 16px 11px 11px', background: STATES.blocked.bg, border: STATES.blocked.border, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', cursor: 'default' }}>
         <div style={{ position: 'absolute', left: '50%', top: '7px', transform: 'translateX(-50%)', width: Math.round(POS.driver.w * 0.52) + 'px', height: '7px', borderRadius: '5px', background: STATES.blocked.tx, opacity: .45 }}></div>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '26px', height: '26px', padding: '0 7px', borderRadius: '9px', background: STATES.blocked.badgeBg, color: STATES.blocked.tx, font: '800 13px/1 Manrope,sans-serif', marginTop: '6px' }}>C</div>
      </div>

      {/* Dynamic Seats */}
      {seats.map((s) => {
        const p = POS[s.pos] || POS[2];
        const S = STATES[s.state] || STATES.available;
        const sel = s.state === 'selected';
        const scale = sel ? 1.05 : 1;
        const mark = s.mark || MARKS[s.state] || s.pos;
        const isClickable = s.state === 'available' || s.state === 'selected';

        return (
          <button 
            key={s.id} 
            onClick={() => isClickable && onSeatSelect(s)}
            style={{
              position: 'absolute', left: p.left + 'px', top: p.top + 'px', width: p.w + 'px', height: p.h + 'px',
              borderRadius: '16px 16px 11px 11px', background: S.bg, border: S.border, boxShadow: S.shadow,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px',
              transform: `scale(${scale})`, transition: 'transform .26s cubic-bezier(.2,.8,.2,1),background .22s ease,border-color .22s ease,box-shadow .26s ease',
              cursor: isClickable ? 'pointer' : 'default', padding: 0
            }}
          >
            <div style={{ position: 'absolute', left: '50%', top: '7px', transform: 'translateX(-50%)', width: Math.round(p.w * 0.52) + 'px', height: '7px', borderRadius: '5px', background: S.tx, opacity: .45 }}></div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '26px', height: '26px', padding: '0 7px', borderRadius: '9px', background: S.badgeBg, color: S.tx, font: '800 13px/1 Manrope,sans-serif', marginTop: '6px' }}>
              {mark}
            </div>
            {s.label && (
              <div style={{ font: '700 9.5px Manrope,sans-serif', letterSpacing: '.05em', color: S.tx, opacity: .9, textAlign: 'center', padding: '0 4px' }}>
                {s.label}
              </div>
            )}
            {sel && (
              <div style={{ position: 'absolute', inset: '-5px', borderRadius: '19px', border: '2px solid var(--jade)', pointerEvents: 'none', animation: 'trRing 1.7s ease-out infinite' }}></div>
            )}
          </button>
        );
      })}

      {showPlate && (
        <div style={{ position: 'absolute', left: '50%', bottom: '-4px', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 12px', borderRadius: '9px', background: 'var(--bg)', boxShadow: 'var(--sh)', whiteSpace: 'nowrap' }}>
          <div style={{ font: "600 12.5px/1 'IBM Plex Mono',monospace", letterSpacing: '.08em' }}>{plate}</div>
          <div style={{ width: '1px', height: '12px', background: 'var(--bd)' }}></div>
          <div style={{ font: '600 11px Manrope,sans-serif', color: 'var(--mu)' }}>{model}</div>
        </div>
      )}
    </div>
  );
}

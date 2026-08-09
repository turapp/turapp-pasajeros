'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import BottomNav from '../../components/BottomNav';

export default function ActivityPage() {
  const router = useRouter();

  const [activityList, setActivityList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrips() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('rider_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setActivityList(data.map((t, idx) => ({
          date: new Date(t.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          price: `$${(t.fare_actual || t.fare_estimated || 0).toLocaleString()}`,
          address: t.dropoff_address,
          img: t.category === 'taxi' ? '/images/car.png' : '/images/car.png',
          hasMap: idx === 0 // Show map for the most recent trip
        })));
      }
      setLoading(false);
    }
    loadTrips();
  }, []);
  return (
    <>
      <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '60px 16px 100px', background: 'var(--bg)', animation: 'trFade .3s ease', fontFamily: 'Manrope, sans-serif', transition: 'background 0.3s ease' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px' }}>
           <div>
             <div style={{ font: '800 36px/1.1 Manrope,sans-serif', letterSpacing: '-0.03em', color: 'var(--tx)', marginBottom: '8px' }}>Actividad</div>
             <div style={{ font: '600 16px Manrope,sans-serif', color: 'var(--mu)' }}>Tus viajes recientes</div>
           </div>
           <button style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}>
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
           </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--mu)', font: '600 14px Manrope,sans-serif' }}>
              Cargando actividad...
            </div>
          ) : activityList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--mu)', font: '600 14px Manrope,sans-serif' }}>
              Aún no tienes viajes.
            </div>
          ) : activityList.map((act, idx) => {
            if (act.hasMap) {
              return (
                <div key={idx} style={{ borderRadius: '24px', border: '1px solid var(--bd)', padding: '16px', display: 'flex', flexDirection: 'column', background: 'var(--bg)', boxShadow: 'var(--sh2)', marginBottom: '24px' }}>
                  
                  {/* Stylized Minimal Map */}
                  <div style={{ width: '100%', height: '160px', borderRadius: '16px', background: 'var(--map)', marginBottom: '20px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="100%" height="100%" viewBox="0 0 400 200" fill="none" style={{ opacity: 0.1 }}>
                       <path d="M-50 50 Q 100 100 200 50 T 450 150" stroke="var(--tx)" strokeWidth="8" strokeLinecap="round" />
                       <path d="M-50 150 Q 50 50 150 100 T 450 50" stroke="var(--tx)" strokeWidth="4" strokeLinecap="round" />
                       <path d="M100 -50 L 150 250" stroke="var(--tx)" strokeWidth="4" strokeLinecap="round" />
                       <path d="M250 -50 L 200 250" stroke="var(--tx)" strokeWidth="12" strokeLinecap="round" />
                    </svg>
                    {/* Route Line */}
                    <svg width="100%" height="100%" viewBox="0 0 400 200" fill="none" style={{ position: 'absolute', inset: 0 }}>
                       <path d="M 120 120 L 250 80" stroke="var(--tx)" strokeWidth="3" strokeDasharray="6 6" />
                    </svg>
                    {/* Pins */}
                    <div style={{ position: 'absolute', top: '120px', left: '120px', transform: 'translate(-50%, -50%)', width: '12px', height: '12px', background: 'var(--tx)', borderRadius: '50%', border: '3px solid var(--bg)', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}></div>
                    <div style={{ position: 'absolute', top: '80px', left: '250px', transform: 'translate(-50%, -50%)', width: '16px', height: '16px', background: 'var(--jade)', borderRadius: '50%', border: '3px solid var(--bg)', boxShadow: '0 4px 8px rgba(0,0,0,0.2)' }}></div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div>
                      <div style={{ font: '800 20px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '4px', letterSpacing: '-0.02em' }}>{act.address}</div>
                      <div style={{ font: '600 13px Manrope,sans-serif', color: 'var(--mu)' }}>{act.date}</div>
                    </div>
                    <div style={{ font: '800 18px Manrope,sans-serif', color: 'var(--tx)' }}>{act.price}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button style={{ flex: 1, background: 'var(--inv)', padding: '14px 16px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', font: '800 14px Manrope,sans-serif', color: 'var(--invtx)', transition: 'all 0.2s ease' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/></svg>
                      Rebook
                    </button>
                    <button style={{ flex: 1, background: 'var(--sf)', padding: '14px 16px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', font: '800 14px Manrope,sans-serif', color: 'var(--tx)', transition: 'all 0.2s ease' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                      Voucher
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderRadius: '20px', border: '1px solid var(--bd)', background: 'var(--bg)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <img src={act.img} alt="" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '800 16px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{act.address}</div>
                  <div style={{ font: '600 12px Manrope,sans-serif', color: 'var(--mu)' }}>{act.date} · <span style={{ color: 'var(--tx)', fontWeight: '800' }}>{act.price}</span></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button style={{ width: '36px', height: '36px', background: 'var(--inv)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--invtx)" strokeWidth="2.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </>
  );
}

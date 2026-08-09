'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { caliService } from '../../../lib/caliService';
import TurCaliCar from '../../../components/TurCaliCar';

export default function SeatMapPage() {
  const router = useRouter();
  const params = useParams();
  const departureId = params.id;
  
  const [seats, setSeats] = useState([]);
  const [departure, setDeparture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    async function loadData() {
      // Mocked load for now: we get the departure and seats
      const deps = await caliService.getDepartures();
      const currentDep = deps.find(d => d.id === departureId);
      setDeparture(currentDep);

      const dbSeats = await caliService.getSeats(departureId);
      
      // Transform db seats to component format
      const mappedSeats = dbSeats.map(s => ({
        id: s.id,
        pos: s.seat_number,
        state: s.status, // available, occupied, reserved
        mark: s.status === 'occupied' || s.status === 'reserved' ? '✖' : s.seat_number,
        dbData: s
      }));
      setSeats(mappedSeats);
      setLoading(false);

      // Subscribe to real-time changes
      const unsub = caliService.subscribeToSeats(departureId, (newSeat) => {
        setSeats(prev => prev.map(s => {
          if (s.id === newSeat.id) {
            return {
              ...s,
              state: newSeat.status,
              mark: newSeat.status === 'occupied' || newSeat.status === 'reserved' ? '✖' : s.pos,
              dbData: newSeat
            };
          }
          return s;
        }));
      });

      return () => unsub();
    }
    
    if (departureId) {
      loadData();
    }
  }, [departureId]);

  const handleSeatSelect = (seat) => {
    if (seat.state === 'available') {
      // Deselect previously selected
      setSeats(prev => prev.map(s => {
        if (s.id === seat.id) return { ...s, state: 'selected' };
        if (s.state === 'selected') return { ...s, state: 'available' };
        return s;
      }));
      setSelectedSeat(seat);
    } else if (seat.state === 'selected') {
      setSeats(prev => prev.map(s => s.id === seat.id ? { ...s, state: 'available' } : s));
      setSelectedSeat(null);
    }
  };

  const handleReserve = async () => {
    if (!selectedSeat) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Debes iniciar sesión para reservar.');
        return router.push('/');
      }
      const userId = user.id;
      
      await caliService.reserveSeat(selectedSeat.id, userId, departure.price_block);
      
      // Confirm and go back or to a success page
      alert('¡Puesto reservado exitosamente!');
      router.push('/home');
    } catch (err) {
      alert('Error reservando puesto. Puede que alguien más lo haya tomado.');
      console.error(err);
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--tx)' }}>Cargando asientos...</div>;

  return (
    <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '50px 0 120px', animation: 'trSlideL .3s cubic-bezier(.2,.8,.2,1)' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '8px 16px 14px' }}>
        <button onClick={() => router.back()} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
          <svg width="19" height="19" viewBox="0 0 17 17" fill="none"><path d="M10.5 3.5 5.5 8.5l5 5" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.035em' }}>Elige tu puesto</div>
          <div style={{ font: '500 11.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px' }}>Buenaventura → Cali</div>
        </div>
        <button style={{ height: '36px', padding: '0 14px', borderRadius: '9px', background: 'var(--sf)', font: '700 12.5px Manrope,sans-serif', display: 'flex', alignItems: 'center', flex: 'none' }}>
          Cancelar
        </button>
      </div>

      <TurCaliCar 
        seats={seats} 
        onSeatSelect={handleSeatSelect} 
        plate={departure?.vehicles?.plate} 
      />

      {/* Checkout Bottom Sheet */}
      <div style={{ position: 'fixed', bottom: selectedSeat ? 0 : '-200px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '390px', background: 'var(--bg)', borderTop: '1px solid var(--bd)', padding: '20px 24px 34px', borderRadius: '24px 24px 0 0', boxShadow: 'var(--sh)', transition: 'bottom 0.3s cubic-bezier(0.2,0.8,0.2,1)', zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ font: '800 20px Manrope', letterSpacing: '-0.03em' }}>Puesto {selectedSeat?.pos}</div>
            <div style={{ font: '600 13px Manrope', color: 'var(--mu)', marginTop: '2px' }}>Abono requerido: 30%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: "800 22px 'IBM Plex Mono'", color: 'var(--jade)' }}>${departure?.price_block}</div>
          </div>
        </div>
        <button onClick={handleReserve} style={{ width: '100%', height: '54px', borderRadius: '14px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 16px Manrope' }}>
          Abonar ${(departure?.price_block * 0.3).toFixed(0)} y Reservar
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAppContext } from '../../context/AppProvider';
import { supabase } from '../../lib/supabaseClient';
import { caliService } from '../../lib/caliService';

const Map = dynamic(() => import('../../components/Map'), { ssr: false, loading: () => <div style={{ background: '#f0f0f0', width: '100%', height: '100%' }} /> });

export default function PassengerIntermunicipal() {
  const router = useRouter();
  const { theme } = useAppContext();
  const isDark = theme === 'dark';
  // step: 'list', 'seats', 'payment', 'confirmed', 'enroute', 'traveling', 'finished'
  const [step, setStep] = useState('list');

  const [departures, setDepartures] = useState([]);
  const [loadingDepartures, setLoadingDepartures] = useState(true);

  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [seats, setSeats] = useState([]); // [{id, seat_number, status}]
  const [selectedSeat, setSelectedSeat] = useState(null); // seat object, local only until paid
  const [reservation, setReservation] = useState(null); // {seat_number, deposit_paid, balance_due, total_price}
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  const [luggage, setLuggage] = useState('Ninguno'); // 'Ninguno', 'Pequeño', 'Grande'

  const [now, setNow] = useState(() => Date.now());

  // Cargar salidas reales
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingDepartures(true);
      const deps = await caliService.getDepartures();
      if (active) {
        setDepartures(deps.filter(d => d.status === 'scheduled'));
        setLoadingDepartures(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  // Reloj para countdowns reales (bloque de precio y salida)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Suscripción en tiempo real a los asientos de la salida elegida
  useEffect(() => {
    if (!selectedDeparture) return;
    const unsub = caliService.subscribeToSeats(selectedDeparture.id, (updatedSeat) => {
      setSeats(prev => prev.map(s => s.id === updatedSeat.id ? { ...s, status: updatedSeat.status } : s));
    });
    return () => unsub();
  }, [selectedDeparture]);

  const openDeparture = useCallback(async (dep) => {
    setSelectedDeparture(dep);
    setSelectedSeat(null);
    const dbSeats = await caliService.getSeats(dep.id);
    setSeats(dbSeats);
    setStep('seats');
  }, []);

  const handleSeatSelect = (seatNumber) => {
    const seat = seats.find(s => s.seat_number === seatNumber);
    if (!seat || seat.status !== 'available') return;
    setSelectedSeat(prev => (prev?.seat_number === seatNumber ? null : seat));
  };

  const handleBook = () => {
    if (selectedSeat) {
      setBookingError(null);
      setStep('payment');
    }
  };

  const confirmPayment = async () => {
    if (!selectedSeat || !selectedDeparture) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBookingError('Debes iniciar sesión para reservar.');
        setBookingLoading(false);
        return;
      }
      const result = await caliService.reserveSeat(selectedSeat.id, selectedDeparture.id);
      setReservation(result.seat);
      setStep('confirmed');
    } catch (err) {
      setBookingError(err.message || 'No se pudo completar la reserva.');
    } finally {
      setBookingLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const formatClock = (iso) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  };

  const minutesUntil = (iso) => Math.max(0, Math.round((new Date(iso).getTime() - now) / 60000));

  // Pricing derivado de la salida real (bloque, precio y ventana de 15 min desde block_changed_at)
  const pricingFor = (dep) => {
    const block = dep.current_block || 1;
    const price = Number(dep.current_price) || 55000;
    const nextPrice = block === 1 ? dep.price_block_2 : block === 2 ? dep.price_block_3 : null;
    const blockChangedAt = dep.block_changed_at ? new Date(dep.block_changed_at).getTime() : now;
    const phaseTimeLeft = Math.max(0, Math.round((blockChangedAt + 15 * 60 * 1000 - now) / 1000));
    return { block, price, nextPrice, phaseTimeLeft };
  };

  const seatsFull = (dep) => (dep.occupied_seats || 0) >= (dep.total_seats || 4);

  // Estado por número de puesto (1-4) para el mockup del vehículo, derivado de los asientos reales
  const seatStatus = { 1: 'available', 2: 'available', 3: 'available', 4: 'available' };
  seats.forEach(s => { seatStatus[s.seat_number] = s.status; });

  const nextDeparture = departures.find(d => !seatsFull(d)) || departures[0];
  const listPricing = nextDeparture ? pricingFor(nextDeparture) : { block: 1, price: 55000, nextPrice: 65000, phaseTimeLeft: 0 };

  const selPricing = selectedDeparture ? pricingFor(selectedDeparture) : null;
  const currentPrice = selPricing?.price || 55000;
  const reservedPrice = reservation?.deposit_paid ?? Math.round(currentPrice * 0.3);
  const pendingPrice = reservation?.balance_due ?? (currentPrice - reservedPrice);
  const seatCountdown = selectedDeparture ? Math.max(0, Math.round((new Date(selectedDeparture.departure_time).getTime() - now) / 1000)) : 0;

  const driverName = selectedDeparture?.profiles
    ? `${selectedDeparture.profiles.first_name || ''} ${selectedDeparture.profiles.last_name || ''}`.trim()
    : 'Conductor';
  const driverInitials = driverName.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'C';
  const vehiclePlate = selectedDeparture?.vehicles?.plate || '—';
  const vehicleModel = [selectedDeparture?.vehicles?.make, selectedDeparture?.vehicles?.model].filter(Boolean).join(' ') || 'Vehículo';
  const bookingCode = selectedSeat ? `TC-${selectedSeat.id.slice(0, 5).toUpperCase()}` : '';

  // Colors based on theme (Interleaving darks and lights for premium feel)
  const bgRoot = 'var(--bg)';
  const colorRoot = 'var(--tx)';
  const bgCard = 'var(--bg)';

  return (
    <div style={{ minHeight: '100vh', background: bgRoot, color: colorRoot, fontFamily: 'Manrope, sans-serif', transition: 'background 0.3s ease' }}>

      {/* 1. LIST OF TRIPS */}
      {step === 'list' && (
        <div style={{ animation: 'trFade .3s ease', paddingBottom: '40px' }}>

          {/* Header Gradient (Always Dark) */}
          <div style={{ position: 'relative', overflow: 'hidden', padding: '60px 16px 32px', background: '#0a0a0a', borderBottomLeftRadius: '32px', borderBottomRightRadius: '32px', marginBottom: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
            <div style={{ position: 'absolute', top: '-100px', right: '-50px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', position: 'relative', zIndex: 2 }}>
              <button onClick={() => router.back()} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <div style={{ background: '#222', borderRadius: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', font: '800 10px Manrope,sans-serif', color: '#fff' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #0f8a6d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '4px', height: '4px', background: '#0f8a6d', borderRadius: '50%' }}></div></div>
                Estás en Buenaventura
              </div>
            </div>
            <div style={{ font: '800 36px Manrope,sans-serif', marginBottom: '16px', color: '#fff', position: 'relative', zIndex: 2, letterSpacing: '-0.03em' }}>Viajes a Cali</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
              <div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', font: '600 13px Manrope,sans-serif', color: '#aaa' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid #0f8a6d' }}></div> Buenaventura · Muelle El Piñal
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', font: '600 13px Manrope,sans-serif', color: '#aaa', marginTop: '6px' }}>
                  <div style={{ width: '8px', height: '8px', background: '#fff' }}></div> Cali · Terminal de Transportes
                </div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16"/></svg>
              </div>
            </div>
          </div>

          <div style={{ padding: '0 16px' }}>
            {/* dynamic Price Card */}
            <div style={{ background: isDark ? 'var(--sf)' : '#FFF7E6', borderRadius: '24px', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.05)', marginBottom: '32px', border: isDark ? '1px solid var(--bd)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <div style={{ display: 'inline-flex', color: 'var(--amber)', font: '800 11px Manrope,sans-serif', letterSpacing: '0.05em' }}>
                  ⚡ PREVENTA ACTIVA
                </div>
                <div style={{ font: '800 12px Manrope,sans-serif', color: 'var(--amber)' }}>Bloque {listPricing.block} / 3</div>
              </div>
              <div style={{ font: '800 48px Manrope,sans-serif', color: 'var(--amber)', letterSpacing: '-0.03em', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                ${listPricing.price.toLocaleString('es-CO')} <span style={{ font: '600 14px Manrope,sans-serif', letterSpacing: '0' }}>por puesto</span>
              </div>

              <div style={{ display: 'flex', gap: '4px', margin: '16px 0 12px' }}>
                <div style={{ height: '4px', flex: 1, background: listPricing.block >= 1 ? 'var(--amber)' : (isDark ? 'var(--bd)' : '#F0E5D1'), borderRadius: '2px' }}></div>
                <div style={{ height: '4px', flex: 1, background: listPricing.block >= 2 ? 'var(--amber)' : (isDark ? 'var(--bd)' : '#F0E5D1'), borderRadius: '2px' }}></div>
                <div style={{ height: '4px', flex: 1, background: listPricing.block >= 3 ? 'var(--amber)' : (isDark ? 'var(--bd)' : '#F0E5D1'), borderRadius: '2px' }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', font: '800 12px Manrope,sans-serif', color: 'var(--amber)' }}>
                <div>{listPricing.nextPrice ? `Sube a $${Number(listPricing.nextPrice).toLocaleString('es-CO')}` : 'Última fase'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>⏱ {formatTime(listPricing.phaseTimeLeft)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
              <div style={{ font: '800 22px Manrope,sans-serif', color: 'var(--tx)', letterSpacing: '-0.02em' }}>Salidas de hoy</div>
              <div style={{ font: '600 12px Manrope,sans-serif', color: 'var(--mu)' }}>{new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · hoy</div>
            </div>

            <div style={{ background: bgCard, borderRadius: '24px', padding: '8px', border: '1px solid var(--bd)', transition: 'all 0.3s ease' }}>
              {loadingDepartures ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--mu)', font: '600 13px Manrope,sans-serif' }}>Cargando salidas...</div>
              ) : departures.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--mu)', font: '600 13px Manrope,sans-serif' }}>No hay salidas programadas por ahora. Vuelve a intentarlo más tarde.</div>
              ) : departures.map((dep, idx) => {
                const full = seatsFull(dep);
                const p = pricingFor(dep);
                const occ = dep.occupied_seats || 0;
                const total = dep.total_seats || 4;
                const dName = dep.profiles ? `${dep.profiles.first_name || ''} ${dep.profiles.last_name || ''}`.trim() : 'Conductor';
                const dVehicle = [dep.vehicles?.make, dep.vehicles?.model].filter(Boolean).join(' ') || 'Vehículo';
                return (
                  <React.Fragment key={dep.id}>
                    {idx > 0 && <div style={{ height: '1px', background: 'var(--bd)', margin: '0 16px' }}></div>}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', opacity: full ? 0.5 : 1, borderRadius: full ? 0 : '16px', border: full ? 'none' : '1.5px solid var(--inv)', margin: full ? 0 : '8px', background: full ? 'transparent' : 'var(--bg)' }}>
                      <div style={{ font: '800 18px Manrope,sans-serif', minWidth: '45px', color: 'var(--tx)' }}>{formatClock(dep.departure_time)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'inline-flex', background: full ? 'var(--sf2)' : 'var(--jadeS)', color: full ? 'var(--mu)' : 'var(--jade)', font: '800 9px Manrope,sans-serif', padding: '4px 8px', borderRadius: '6px', marginBottom: '4px', letterSpacing: '0.05em' }}>{full ? 'LLENO' : 'CON CUPOS'}</div>
                        <div style={{ font: '600 13px Manrope,sans-serif', color: 'var(--mu)' }}><span style={{ color: 'var(--tx)', fontWeight: '800' }}>{dName}</span> · {dVehicle}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[1, 2, 3, 4].map(n => (
                              <div key={n} style={{ width: '8px', height: '8px', borderRadius: '50%', background: n <= occ ? 'var(--jade)' : 'var(--sf2)' }}></div>
                            ))}
                          </div>
                          <div style={{ font: '800 11px Manrope,sans-serif', color: full ? 'var(--mu)' : 'var(--jade)' }}>{occ}/{total} <span style={{ fontWeight: '500', color: 'var(--mu)' }}>{full ? 'Sin cupos' : `quedan ${total - occ} cupos`}</span></div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ font: '800 16px Manrope,sans-serif', color: full ? 'var(--mu)' : 'var(--tx)', marginBottom: '4px' }}>${p.price.toLocaleString('es-CO')}</div>
                        <div style={{ font: '600 10px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '12px' }}>sale en {minutesUntil(dep.departure_time)} min</div>
                        {full ? (
                          <div style={{ background: 'var(--sf2)', color: 'var(--mu)', padding: '10px 16px', borderRadius: '12px', font: '800 12px Manrope,sans-serif', display: 'inline-block' }}>Lleno</div>
                        ) : (
                          <button onClick={() => openDeparture(dep)} style={{ background: 'var(--inv)', color: 'var(--invtx)', padding: '10px 16px', borderRadius: '12px', font: '800 13px Manrope,sans-serif', transition: 'all 0.2s ease', display: 'inline-block' }}>Reservar</button>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. SEAT SELECTION */}
      {step === 'seats' && selectedDeparture && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff', animation: 'trFade .3s ease' }}>

          <div style={{ padding: '60px 16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setStep('list')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ font: '800 18px Manrope,sans-serif' }}>Elige tu puesto</div>
              <div style={{ font: '600 12px Manrope,sans-serif', color: '#666' }}>Buenaventura → Cali · {formatClock(selectedDeparture.departure_time)}</div>
            </div>
            <div style={{ background: '#FFF4E0', color: '#c98a1e', padding: '6px 12px', borderRadius: '16px', font: '800 12px Manrope,sans-serif', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ⏱ {formatTime(seatCountdown)}
            </div>
          </div>

          <div style={{ padding: '0 24px', marginBottom: '16px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
               <div style={{ font: '800 16px Manrope,sans-serif' }}>
                 {Object.values(seatStatus).every(s => s !== 'available') ? 'Salida llena' : `Quedan ${Object.values(seatStatus).filter(s => s === 'available').length} cupos`} <span style={{ color: '#888', font: '600 12px Manrope,sans-serif' }}>· se llena rápido</span>
               </div>
               <div style={{ font: '800 20px Manrope,sans-serif', color: Object.values(seatStatus).every(s => s !== 'available') ? '#FF4D4D' : '#0f8a6d' }}>
                 {Object.values(seatStatus).filter(s => s !== 'available').length}/4 <div style={{ font: '600 10px Manrope,sans-serif', color: '#888', textAlign: 'right', marginTop: '-4px' }}>CUPOS</div>
               </div>
             </div>
             <div style={{ height: '6px', background: '#f4f4f3', borderRadius: '3px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${(Object.values(seatStatus).filter(s => s !== 'available').length / 4) * 100}%`, background: Object.values(seatStatus).every(s => s !== 'available') ? '#FF4D4D' : '#0f8a6d', borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
             </div>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', opacity: Object.values(seatStatus).every(s => s !== 'available') ? 0.4 : 1, transition: 'opacity 0.3s ease' }}>
            {/* Top-down Car visualization (Minimal Light Theme) */}
            <div style={{ width: '260px', height: '480px', position: 'relative' }}>

              {/* Wheels */}
              <div style={{ position: 'absolute', top: '70px', left: '-6px', width: '20px', height: '45px', background: '#444', borderRadius: '8px' }}></div>
              <div style={{ position: 'absolute', top: '70px', right: '-6px', width: '20px', height: '45px', background: '#444', borderRadius: '8px' }}></div>
              <div style={{ position: 'absolute', bottom: '70px', left: '-6px', width: '20px', height: '45px', background: '#444', borderRadius: '8px' }}></div>
              <div style={{ position: 'absolute', bottom: '70px', right: '-6px', width: '20px', height: '45px', background: '#444', borderRadius: '8px' }}></div>

              {/* Car Body Base */}
              <div style={{ position: 'absolute', inset: 0, background: '#f8f9fa', borderRadius: '100px 100px 80px 80px', boxShadow: '0 20px 40px rgba(0,0,0,0.06), inset 0 0 20px rgba(0,0,0,0.02)', border: '1px solid #eaeae8', overflow: 'hidden' }}>

                {/* Windshield */}
                <div style={{ position: 'absolute', top: '40px', left: '20px', right: '20px', height: '60px', background: 'linear-gradient(180deg, #e0e4e8 0%, #d0d4d8 100%)', borderRadius: '40px 40px 10px 10px' }}></div>

                {/* Back Window */}
                <div style={{ position: 'absolute', bottom: '30px', left: '30px', right: '30px', height: '30px', background: 'linear-gradient(180deg, #d0d4d8 0%, #e0e4e8 100%)', borderRadius: '10px 10px 40px 40px' }}></div>

                {/* Inner Cabin */}
                <div style={{ position: 'absolute', top: '120px', bottom: '80px', left: '16px', right: '16px', background: '#fff', borderRadius: '40px', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.02)' }}>

                  {/* Driver Seat */}
                  <div style={{ position: 'absolute', top: '24px', left: '16px', width: '80px', height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                     <div style={{ width: '40px', height: '6px', background: '#ccc', borderRadius: '3px', marginBottom: '8px' }}></div>
                     <div style={{ width: '32px', height: '32px', background: '#eaeae8', borderRadius: '8px', marginBottom: '8px' }}></div>
                     <div style={{ font: '800 10px Manrope,sans-serif', color: '#888' }}>CONDUCTOR</div>
                  </div>

                  {/* Seat 1 (Front) */}
                  <div style={{ position: 'absolute', top: '24px', right: '16px', width: '80px', height: '80px' }}>
                    {selectedSeat?.seat_number === 1 && (
                      <div style={{ position: 'absolute', inset: '-6px', borderRadius: '26px', border: '3px solid rgba(255,165,0,0.5)', animation: 'trPulse 2s infinite ease-out' }}></div>
                    )}
                    <button
                      onClick={() => handleSeatSelect(1)}
                      style={{ position: 'absolute', inset: 0, borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', font: '800 18px Manrope,sans-serif', border: '2px solid', transition: 'all 0.2s ease', zIndex: 2,
                        background: seatStatus[1] !== 'available' ? '#FFEBEB' : selectedSeat?.seat_number === 1 ? '#FFF4E0' : '#fff',
                        borderColor: seatStatus[1] !== 'available' ? '#FF7F7F' : selectedSeat?.seat_number === 1 ? '#FFA500' : '#0f8a6d',
                        color: seatStatus[1] !== 'available' ? '#FF4D4D' : selectedSeat?.seat_number === 1 ? '#FFA500' : '#0f8a6d',
                        boxShadow: selectedSeat?.seat_number === 1 ? '0 0 0 4px rgba(255,165,0,0.2)' : '0 4px 12px rgba(0,0,0,0.05)'
                      }}>
                      <div style={{ width: '32px', height: '6px', background: 'currentColor', borderRadius: '3px', marginBottom: '8px', opacity: 0.5 }}></div>
                      1
                      <span style={{ fontSize: '10px', marginTop: '2px' }}>ADELANTE</span>
                    </button>
                  </div>

                  {/* Back Seats Line */}
                  <div style={{ position: 'absolute', top: '140px', left: '16px', right: '16px', height: '2px', background: '#f4f4f3' }}></div>

                  {/* Back Seats */}
                  {[2, 3, 4].map((s, idx) => (
                    <div key={s} style={{ position: 'absolute', top: '160px', left: `${16 + (idx * 68)}px`, width: '60px', height: '80px' }}>
                      {selectedSeat?.seat_number === s && (
                        <div style={{ position: 'absolute', inset: '-6px', borderRadius: '22px', border: '3px solid rgba(255,165,0,0.5)', animation: 'trPulse 2s infinite ease-out' }}></div>
                      )}
                      <button
                        onClick={() => handleSeatSelect(s)}
                        style={{ position: 'absolute', inset: 0, borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', font: '800 18px Manrope,sans-serif', border: '2px solid', transition: 'all 0.2s ease', zIndex: 2,
                          background: seatStatus[s] !== 'available' ? '#FFEBEB' : selectedSeat?.seat_number === s ? '#FFF4E0' : '#fff',
                          borderColor: seatStatus[s] !== 'available' ? '#FF7F7F' : selectedSeat?.seat_number === s ? '#FFA500' : '#0f8a6d',
                          color: seatStatus[s] !== 'available' ? '#FF4D4D' : selectedSeat?.seat_number === s ? '#FFA500' : '#0f8a6d',
                          boxShadow: selectedSeat?.seat_number === s ? '0 0 0 4px rgba(255,165,0,0.2)' : '0 4px 12px rgba(0,0,0,0.05)'
                        }}>
                        <div style={{ width: '24px', height: '6px', background: 'currentColor', borderRadius: '3px', marginBottom: '8px', opacity: 0.5 }}></div>
                        {s}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* License Plate Pill */}
              <div style={{ position: 'absolute', bottom: '-20px', left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: '99px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 10, border: '1px solid #eaeae8' }}>
                <div style={{ font: '800 12px Manrope,sans-serif', color: '#111', letterSpacing: '0.05em' }}>{vehiclePlate}</div>
                <div style={{ width: '1px', height: '12px', background: '#eaeae8' }}></div>
                <div style={{ font: '600 12px Manrope,sans-serif', color: '#666' }}>{vehicleModel}</div>
              </div>

            </div>
          </div>

          {Object.values(seatStatus).every(s => s !== 'available') ? (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '32px 24px', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)', zIndex: 20 }}>
              <div style={{ font: '800 20px Manrope,sans-serif', marginBottom: '8px' }}>Esta salida ya está completa</div>
              <div style={{ font: '500 14px/1.5 Manrope,sans-serif', color: '#666', marginBottom: '24px' }}>
                Los cuatro puestos se reservaron. Revisa la lista para ver la siguiente salida con cupos disponibles.
              </div>
              <button onClick={() => setStep('list')} style={{ width: '100%', height: '56px', borderRadius: '16px', background: '#111', color: '#fff', font: '800 16px Manrope,sans-serif', marginBottom: '16px' }}>
                Ver otras salidas
              </button>
            </div>
          ) : (
            <div style={{ padding: '40px 24px 24px', borderTop: '1px solid #eaeae8' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '12px', font: '600 12px Manrope,sans-serif', color: '#666' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '16px', borderRadius: '6px', border: '2px solid #0f8a6d' }}></div> Disponible</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '16px', borderRadius: '6px', background: '#111' }}></div> Seleccionado</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '16px', height: '16px', borderRadius: '6px', background: '#FF4D4D' }}></div> Ocupado</div>
              </div>
              <button
                onClick={handleBook}
                disabled={!selectedSeat}
                style={{ width: '100%', height: '56px', borderRadius: '16px', background: selectedSeat ? '#111' : '#eaeae8', color: selectedSeat ? '#fff' : '#aaa', font: '800 16px Manrope,sans-serif', transition: 'all 0.2s ease' }}>
                Continuar
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. PAYMENT */}
      {step === 'payment' && selectedSeat && (
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#fcfcfc', color: '#111', animation: 'trSlideL .3s ease' }}>

          <div style={{ position: 'sticky', top: 0, background: 'rgba(252,252,252,0.85)', backdropFilter: 'blur(12px)', zIndex: 10, padding: '40px 24px 20px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <button onClick={() => setStep('seats')} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff', border: '1px solid #eaeaea', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
               </button>
               <div style={{ font: '800 22px/1 Manrope,sans-serif', letterSpacing: '-0.03em' }}>Resumen del viaje</div>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            {/* Route Summary */}
            <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #1a1a1a, #333)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}><span style={{fontSize: '28px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'}}>🚙</span></div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 18px Manrope,sans-serif', letterSpacing: '-0.02em', color: '#111', marginBottom: '4px' }}>Buenaventura → Cali</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', font: '600 13px Manrope,sans-serif', color: '#666' }}>
                  <div style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: '6px' }}>Hoy, {formatClock(selectedDeparture.departure_time)}</div>
                  <div style={{ background: '#e0f2f1', color: '#0f8a6d', padding: '4px 8px', borderRadius: '6px' }}>Puesto {selectedSeat.seat_number}</div>
                </div>
              </div>
            </div>

            <div style={{ font: '800 18px Manrope,sans-serif', letterSpacing: '-0.02em', marginBottom: '20px', color: '#111' }}>Estructura de pago</div>

            <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', marginBottom: '32px', boxShadow: '0 8px 24px rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', position: 'relative' }}>
                <div style={{ position: 'absolute', left: '15px', top: '32px', bottom: '-8px', width: '2px', background: '#e0f2f1' }}></div>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#0f8a6d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px Manrope,sans-serif', zIndex: 2, boxShadow: '0 4px 12px rgba(15, 138, 109, 0.3)' }}>1</div>
                <div style={{ flex: 1, paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ font: '800 16px Manrope,sans-serif', color: '#111' }}>Reserva ahora</div>
                    <div style={{ font: '800 16px Manrope,sans-serif', color: '#0f8a6d' }}>${reservedPrice.toLocaleString('es-CO')}</div>
                  </div>
                  <div style={{ font: '500 13px/1.5 Manrope,sans-serif', color: '#666' }}>Aseguras tu puesto en el vehículo para viajar a la hora indicada.</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f5f5f5', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px Manrope,sans-serif', zIndex: 2 }}>2</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ font: '800 16px Manrope,sans-serif', color: '#111' }}>Pagas al abordar</div>
                    <div style={{ font: '800 16px Manrope,sans-serif', color: '#111' }}>${pendingPrice.toLocaleString('es-CO')}</div>
                  </div>
                  <div style={{ font: '500 13px/1.5 Manrope,sans-serif', color: '#666' }}>El resto lo pagas en efectivo o Nequi directamente al conductor.</div>
                </div>
              </div>
            </div>

            <div style={{ font: '800 18px Manrope,sans-serif', letterSpacing: '-0.02em', marginBottom: '16px', color: '#111' }}>Equipaje (Opcional)</div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
              {[{lbl: 'Ninguno', icon: '🚫', desc: 'Solo tú'}, {lbl: 'Pequeño', icon: '🎒', desc: 'Mochila'}, {lbl: 'Grande', icon: '🧳', desc: 'Bodega'}].map(l => (
                <button key={l.lbl} onClick={() => setLuggage(l.lbl)} style={{ flex: 1, padding: '16px 8px', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '2px solid', borderColor: luggage === l.lbl ? '#111' : 'transparent', background: luggage === l.lbl ? '#f9f9f9' : '#fff', color: '#111', transition: 'all 0.2s ease', boxShadow: luggage === l.lbl ? 'none' : '0 4px 12px rgba(0,0,0,0.03)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: luggage === l.lbl ? '#111' : '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s ease' }}>
                     <span style={{ fontSize: '24px' }}>{l.icon}</span>
                  </div>
                  <div style={{ font: '800 14px Manrope,sans-serif' }}>{l.lbl}</div>
                  <div style={{ font: '500 11px Manrope,sans-serif', color: '#888' }}>{l.desc}</div>
                </button>
              ))}
            </div>

            {bookingError && (
              <div style={{ background: '#FFEBEB', color: '#c0392b', padding: '14px 16px', borderRadius: '14px', font: '600 13px/1.5 Manrope,sans-serif', marginBottom: '20px' }}>{bookingError}</div>
            )}

            <button onClick={confirmPayment} disabled={bookingLoading} style={{ width: '100%', height: '60px', borderRadius: '20px', background: bookingLoading ? '#888' : 'linear-gradient(135deg, #111, #333)', color: '#fff', font: '800 17px Manrope,sans-serif', boxShadow: '0 12px 24px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              {bookingLoading ? 'Procesando...' : `Pagar reserva · $${reservedPrice.toLocaleString('es-CO')}`}
              {!bookingLoading && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
            </button>
          </div>
        </div>
      )}

      {/* 4. CONFIRMED & QR */}
      {step === 'confirmed' && reservation && (
        <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', animation: 'trFade .3s ease' }}>

          <button onClick={() => router.push('/home')} style={{ position: 'absolute', top: '56px', right: '20px', width: '36px', height: '36px', borderRadius: '50%', background: '#f4f4f3', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>

          <div style={{ padding: '60px 24px 24px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#0f8a6d', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ font: '800 24px Manrope,sans-serif', letterSpacing: '-0.02em', marginBottom: '8px' }}>Tu puesto está asegurado</div>
            <div style={{ font: '500 14px Manrope,sans-serif', color: '#666' }}>Muéstrale este código al conductor cuando subas al carro.</div>
          </div>

          <div style={{ margin: '0 24px 24px', border: '1px solid #eaeae8', borderRadius: '24px', background: '#fff', boxShadow: '0 12px 32px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ width: '160px', height: '160px', margin: '0 auto 24px', background: `url(https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${bookingCode}) center/cover` }}></div>
              <div style={{ font: '700 11px Manrope,sans-serif', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>CÓDIGO DE RESERVA</div>
              <div style={{ font: '800 26px Manrope,sans-serif', letterSpacing: '0.25em', color: '#111' }}>{bookingCode}</div>
            </div>

            <div style={{ borderTop: '2px dashed #eaeae8', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-10px', left: '-10px', width: '20px', height: '20px', background: '#f8f8f8', borderRadius: '50%', borderRight: '1px solid #eaeae8' }}></div>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '20px', height: '20px', background: '#f8f8f8', borderRadius: '50%', borderLeft: '1px solid #eaeae8' }}></div>

              <div style={{ display: 'flex', padding: '24px' }}>
                <div style={{ flex: 1, borderRight: '1px solid #eaeae8' }}>
                  <div style={{ font: '600 11px Manrope,sans-serif', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Puesto</div>
                  <div style={{ font: '800 18px Manrope,sans-serif', color: '#111' }}>{reservation.seat_number}</div>
                </div>
                <div style={{ flex: 1, paddingLeft: '16px', borderRight: '1px solid #eaeae8' }}>
                  <div style={{ font: '600 11px Manrope,sans-serif', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Salida</div>
                  <div style={{ font: '800 18px Manrope,sans-serif', color: '#111' }}>{formatClock(selectedDeparture.departure_time)}</div>
                </div>
                <div style={{ flex: 1.2, paddingLeft: '16px' }}>
                  <div style={{ font: '600 11px Manrope,sans-serif', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Pendiente</div>
                  <div style={{ font: '800 18px Manrope,sans-serif', color: '#c98a1e' }}>${pendingPrice.toLocaleString('es-CO')}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ margin: '0 24px 24px', background: '#111', borderRadius: '20px', padding: '20px 24px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div>
                <div style={{ font: '700 10px Manrope,sans-serif', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>SALE EN</div>
                <div style={{ font: '800 24px Manrope,sans-serif' }}>{formatTime(seatCountdown)}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 10px Manrope,sans-serif', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Punto de encuentro</div>
              <div style={{ font: '800 15px Manrope,sans-serif', color: '#74c0e3' }}>Muelle El Piñal</div>
            </div>
          </div>

          <div style={{ margin: '0 24px 24px', borderRadius: '24px', border: '1px solid #eaeae8', overflow: 'hidden' }}>
            <div style={{ height: '160px', position: 'relative' }}>
               <Map center={[3.8801, -77.0267]} zoom={19} markers={[]} />
               <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                 <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '2px dashed #0f8a6d', opacity: 0.3, position: 'absolute' }}></div>
                 <div style={{ width: '160px', height: '160px', borderRadius: '50%', border: '2px dashed #0f8a6d', opacity: 0.2, position: 'absolute' }}></div>
                 <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#0f8a6d', border: '3px solid #fff', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', zIndex: 10 }}></div>
               </div>
            </div>
            <div style={{ padding: '20px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ font: '800 15px Manrope,sans-serif', marginBottom: '4px' }}>Buenaventura · Muelle El Piñal</div>
                <div style={{ font: '500 12px Manrope,sans-serif', color: '#666' }}>Llega 10 minutos antes de la hora de salida.</div>
              </div>
              <button onClick={() => setStep('enroute')} style={{ background: '#f4f4f3', color: '#111', font: '800 13px Manrope,sans-serif', padding: '12px 16px', borderRadius: '12px' }}>
                Cómo llegar
              </button>
            </div>
          </div>

          <div style={{ margin: '0 24px 24px', background: '#f8f8f8', borderRadius: '24px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eaeae8', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 16px Manrope,sans-serif', color: '#111' }}>{driverInitials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 16px Manrope,sans-serif' }}>{driverName}</div>
              <div style={{ font: '500 13px Manrope,sans-serif', color: '#666' }}>{vehicleModel} · {vehiclePlate}</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', border: '1px solid #eaeae8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              </button>
              <button style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', border: '1px solid #eaeae8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </button>
            </div>
          </div>

          <div style={{ padding: '0 24px 40px', display: 'flex', gap: '16px' }}>
            <button onClick={() => setStep('enroute')} style={{ flex: 1.5, height: '56px', borderRadius: '16px', background: '#f4f4f3', color: '#111', font: '800 16px Manrope,sans-serif', transition: 'all 0.2s ease' }}>
              Seguir el viaje
            </button>
            <button style={{ flex: 1, height: '56px', borderRadius: '16px', background: '#fff', border: '1px solid #FF7F7F', color: '#FF4D4D', font: '800 16px Manrope,sans-serif', transition: 'all 0.2s ease' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* 5. ENROUTE TRACKING (Seguimiento) */}
      {step === 'enroute' && reservation && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#fff', animation: 'trFade .3s ease' }}>

          <div style={{ position: 'absolute', inset: 0, bottom: '400px', zIndex: 1, background: '#f0f0f0' }}>
             <Map center={[3.8801, -77.0267]} zoom={19} markers={[{ position: [3.8801, -77.0267], popup: 'Muelle El Piñal' }]} />
             <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
               <polyline points="20,80 20,40 60,40 60,10" fill="none" stroke="#111" strokeWidth="2.5" />
               <circle cx="60" cy="10" r="2.5" fill="#0f8a6d" />
               <rect x="18" y="78" width="4" height="4" rx="1" fill="#111" />
             </svg>
          </div>

          <div style={{ position: 'absolute', top: '60px', left: '16px', right: '16px', zIndex: 10, display: 'flex', justifyContent: 'space-between' }}>
             <button onClick={() => router.back()} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
             </button>
          </div>

          <div style={{ position: 'absolute', top: '120px', left: '16px', zIndex: 10, background: '#fff', borderRadius: '99px', padding: '12px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0f8a6d' }}></div>
            <div style={{ font: '800 13px Manrope,sans-serif' }}>{driverName.split(' ')[0] || 'El conductor'} va llegando al punto de encuentro</div>
            <div style={{ font: '800 13px Manrope,sans-serif', color: '#0f8a6d', marginLeft: '4px' }}>{formatTime(seatCountdown)}</div>
          </div>

          {/* Bottom Sheet */}
          <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: '#fff', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '32px 24px', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px', position: 'relative' }}>

              <div style={{ position: 'absolute', left: '7px', top: '10px', bottom: '20px', width: '2px', background: '#e0e0e0', zIndex: 0 }}></div>
              <div style={{ position: 'absolute', left: '7px', top: '10px', height: '60%', width: '2px', background: '#0f8a6d', zIndex: 0 }}></div>

              <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#0f8a6d', marginTop: '2px' }}></div>
                <div>
                  <div style={{ font: '800 15px Manrope,sans-serif' }}>Reserva confirmada</div>
                  <div style={{ font: '500 13px Manrope,sans-serif', color: '#888' }}>{formatClock(selectedDeparture.departure_time)} · ${reservedPrice.toLocaleString('es-CO')}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#0f8a6d', marginTop: '2px' }}></div>
                <div>
                  <div style={{ font: '800 15px Manrope,sans-serif' }}>Ocupación del vehículo</div>
                  <div style={{ font: '500 13px Manrope,sans-serif', color: '#888' }}>{seats.filter(s => s.status !== 'available').length} de {(selectedDeparture.total_seats || 4)} puestos reservados</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', border: '4px solid #0f8a6d', marginTop: '2px' }}></div>
                <div>
                  <div style={{ font: '800 15px Manrope,sans-serif' }}>Conductor en camino</div>
                  <div style={{ font: '500 13px Manrope,sans-serif', color: '#888' }}>Llegando al punto de encuentro</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1, opacity: 0.5 }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#e0e0e0', marginTop: '2px' }}></div>
                <div>
                  <div style={{ font: '800 15px Manrope,sans-serif' }}>En ruta</div>
                  <div style={{ font: '500 13px Manrope,sans-serif', color: '#888' }}>~3 h estimadas hasta Cali</div>
                </div>
              </div>
            </div>

            <div style={{ background: '#FFF4E0', color: '#c98a1e', padding: '16px', borderRadius: '12px', font: '800 13px Manrope,sans-serif', marginBottom: '24px' }}>
              ${pendingPrice.toLocaleString('es-CO')} <span style={{ font: '600 12px Manrope,sans-serif', color: '#888' }}>Es lo que le pagas al conductor al subir.</span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ width: '56px', height: '56px', borderRadius: '16px', border: '1px solid #eaeae8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </button>
              <button onClick={() => setStep('traveling')} style={{ flex: 1, height: '56px', borderRadius: '16px', background: '#111', color: '#fff', font: '800 16px Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Ya subí al carro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. TRAVELING */}
      {step === 'traveling' && reservation && (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#fff', animation: 'trFade .3s ease' }}>

          <button onClick={() => router.push('/home')} style={{ position: 'absolute', top: '60px', right: '16px', zIndex: 10, width: '40px', height: '40px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>

          <div style={{ position: 'absolute', inset: 0, bottom: '200px', zIndex: 1, background: '#f0f0f0' }}>
             <Map center={[3.6659, -76.7794]} zoom={8} markers={[{ position: [3.8801, -77.0267], popup: 'Buenaventura' }, { position: [3.4516, -76.5320], popup: 'Cali' }]} />
             <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }} viewBox="0 0 100 100" preserveAspectRatio="none">
               <polyline points="20,80 80,20 80,10" fill="none" stroke="#ccc" strokeWidth="2" strokeDasharray="4 4" />
               <polyline points="20,80 40,60" fill="none" stroke="#111" strokeWidth="3" />
               <circle cx="40" cy="60" r="3" fill="#111" />
               <circle cx="20" cy="80" r="2.5" fill="#0f8a6d" />
               <circle cx="80" cy="10" r="2.5" fill="#888" />
             </svg>
          </div>

          <div style={{ position: 'absolute', top: '60px', left: '16px', right: '16px', zIndex: 10, background: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0f8a6d' }}></div>
                <div style={{ font: '800 15px Manrope,sans-serif' }}>En ruta a Cali</div>
              </div>
              <div style={{ font: '800 18px Manrope,sans-serif' }}>166 <span style={{ font: '600 13px Manrope,sans-serif', color: '#888' }}>min</span></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 11px Manrope,sans-serif', color: '#888' }}>
              <div>Muelle El Piñal</div>
              <div>Terminal de Cali</div>
            </div>
            <div style={{ height: '4px', background: '#f0f0f0', borderRadius: '2px', marginTop: '16px', position: 'relative' }}>
              <div style={{ width: '30%', height: '100%', background: '#0f8a6d', borderRadius: '2px' }}></div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: '#fff', borderTopLeftRadius: '32px', borderTopRightRadius: '32px', padding: '32px 24px', boxShadow: '0 -4px 32px rgba(0,0,0,0.1)' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f4f4f3', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 18px Manrope,sans-serif' }}>{driverInitials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 18px Manrope,sans-serif' }}>{driverName}</div>
                <div style={{ font: '500 13px Manrope,sans-serif', color: '#666' }}>{vehiclePlate} · Puesto {reservation.seat_number}/4</div>
              </div>
              <div style={{ background: '#e7f3ef', color: '#0f8a6d', font: '800 11px Manrope,sans-serif', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> ABONADO
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button style={{ flex: 1, height: '56px', borderRadius: '16px', background: '#FFF4E0', color: '#c98a1e', font: '800 16px Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Seguridad
              </button>
              <button onClick={() => setStep('finished')} style={{ flex: 1.5, height: '56px', borderRadius: '16px', background: '#111', color: '#fff', font: '800 16px Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                Llegué
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. FINISHED (Viaje finalizado) */}
      {step === 'finished' && reservation && (
        <div style={{ minHeight: '100vh', background: '#fff', color: '#111', display: 'flex', flexDirection: 'column', animation: 'trFade .3s ease' }}>

          <div style={{ padding: '60px 24px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px' }}></div>
            <div style={{ font: '800 16px Manrope,sans-serif' }}>Tu viaje</div>
            <button onClick={() => router.push('/home')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f4f4f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div style={{ flex: 1, padding: '0 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#0f8a6d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ font: '800 28px Manrope,sans-serif', marginBottom: '8px', letterSpacing: '-0.02em' }}>Llegaste a Cali</div>
            <div style={{ font: '500 14px/1.4 Manrope,sans-serif', color: '#666', textAlign: 'center', marginBottom: '40px' }}>
              Tu viaje terminó. El conductor ya recibió el saldo pendiente.
            </div>

            <div style={{ width: '100%', borderTop: '1px solid #eaeae8', borderBottom: '1px solid #eaeae8', padding: '24px 0', marginBottom: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ font: '600 14px Manrope,sans-serif', color: '#666' }}>Puesto</div>
                <div style={{ font: '800 14px Manrope,sans-serif' }}>{reservation.seat_number}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ font: '600 14px Manrope,sans-serif', color: '#666' }}>Reserva (abono)</div>
                <div style={{ font: '800 14px Manrope,sans-serif' }}>${reservedPrice.toLocaleString('es-CO')}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ font: '600 14px Manrope,sans-serif', color: '#666' }}>Pagado al conductor</div>
                <div style={{ font: '800 14px Manrope,sans-serif' }}>${pendingPrice.toLocaleString('es-CO')}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px dashed #eaeae8' }}>
                <div style={{ font: '800 18px Manrope,sans-serif' }}>Total</div>
                <div style={{ font: '800 18px Manrope,sans-serif' }}>${(reservation.total_price || currentPrice).toLocaleString('es-CO')}</div>
              </div>
            </div>

            <div style={{ font: '800 16px Manrope,sans-serif', marginBottom: '16px' }}>Califica a {driverName.split(' ')[0] || 'tu conductor'}</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '40px' }}>
              {[1,2,3,4,5].map(star => (
                <div key={star} style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="#eaeae8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </div>
              ))}
            </div>

            <button onClick={() => setStep('list')} style={{ width: '100%', height: '56px', borderRadius: '16px', background: '#111', color: '#fff', font: '800 16px Manrope,sans-serif', marginBottom: '16px' }}>
              Reservar el regreso
            </button>
            <button onClick={() => router.push('/home')} style={{ font: '700 14px Manrope,sans-serif', color: '#666', background: 'none', border: 'none' }}>
              Volver al inicio
            </button>

          </div>
        </div>
      )}
    </div>
  );
}

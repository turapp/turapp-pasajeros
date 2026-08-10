'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { supabase } from '../../lib/supabaseClient';
import BottomNav from '../../components/BottomNav';
import { taxiEstimatedFare, haversineKm, CARRERA_MINIMA } from '../../lib/pricing';

const Map = dynamic(() => import('../../components/Map'), { ssr: false, loading: () => <div style={{ background: '#eee', height: '100%' }} /> });

const PAYMENT_METHOD_LABEL = { cash: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata', card: 'Tarjeta' };
const PAYMENT_METHOD_ICON = { cash: '💵', nequi: 'NQ', daviplata: 'DP', card: 'VISA' };

export default function HomePage() {
  const router = useRouter();
  const [step, setStep] = useState('home'); // home, address, select, paywith, searching, matched, trip, rate
  const [tab, setTab] = useState('ride'); // ride, send
  const [pickupProg, setPickupProg] = useState(0);
  const [tripProg, setTripProg] = useState(0);
  const [tripId, setTripId] = useState(null);
  const [tripPin, setTripPin] = useState(null);
  const [matchedDriverId, setMatchedDriverId] = useState(null);
  const [driverLoc, setDriverLoc] = useState([3.8822, -77.0250]);
  const [pickupLoc, setPickupLoc] = useState([3.8801, -77.0267]); // Buenaventura real (antes 4.88, mal ubicado)
  const [pickupAddress, setPickupAddress] = useState('Terminal Marítimo');
  const [dropoffLoc, setDropoffLoc] = useState([3.8772, -77.0200]);
  const [dropoffAddress, setDropoffAddress] = useState('Centro');

  // Búsqueda real de direcciones (Nominatim/OpenStreetMap vía /api/geocode),
  // acotada a Buenaventura. activeField dice cuál de los dos inputs (pickup o
  // destino) está mostrando resultados en este momento.
  const [activeField, setActiveField] = useState('destination'); // 'pickup' | 'destination'
  const [pickupQuery, setPickupQuery] = useState('');
  const [pickupResults, setPickupResults] = useState([]);
  const [pickupSearching, setPickupSearching] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationResults, setDestinationResults] = useState([]);
  const [destinationSearching, setDestinationSearching] = useState(false);

  function useAddressSearch(query, setResults, setSearching) {
    useEffect(() => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          setResults(data);
        } catch {
          setResults([]);
        } finally {
          setSearching(false);
        }
      }, 200);
      return () => clearTimeout(timer);
    }, [query]);
  }

  useAddressSearch(pickupQuery, setPickupResults, setPickupSearching);
  useAddressSearch(destinationQuery, setDestinationResults, setDestinationSearching);

  const shortAddress = (display_name) => display_name.split(',').slice(0, 2).join(',').trim();
  const splitAddress = (display_name) => {
    const parts = display_name.split(',').map(p => p.trim());
    return { primary: parts[0], secondary: parts.slice(1, 3).join(', ') };
  };

  const handleSelectDestination = (result) => {
    setDropoffLoc([result.lat, result.lon]);
    setDropoffAddress(shortAddress(result.display_name));
    setDestinationQuery('');
    setDestinationResults([]);
    setStep('select');
  };

  const handleSelectPickup = (result) => {
    setPickupLoc([result.lat, result.lon]);
    setPickupAddress(shortAddress(result.display_name));
    setPickupQuery('');
    setPickupResults([]);
    setActiveField('destination');
  };

  // Tarifa de taxi con piso legal (Decreto 0048 de 2026, Buenaventura) sobre la
  // distancia estimada del viaje. "Particular" no está regulado por el decreto
  // (placa blanca, precio negociable), así que arranca un poco por debajo y se
  // ajusta con los botones +/-.
  const distanceKm = haversineKm(pickupLoc, dropoffLoc);
  const taxiFare = taxiEstimatedFare(distanceKm);
  const [particularOffer, setParticularOffer] = useState(null);
  const particularBase = Math.max(CARRERA_MINIMA, taxiFare - 3000);
  const particularFare = particularOffer ?? particularBase;
  const [selectedVehicle, setSelectedVehicle] = useState(null); // 'taxi' | 'particular'
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'nequi' | 'daviplata' | 'card'
  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);

  useEffect(() => {
    async function loadSavedMethods() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      setSavedPaymentMethods(data || []);
      const def = (data || []).find(m => m.is_default);
      if (def) setPaymentMethod(def.type);
    }
    loadSavedMethods();
  }, []);

  // Escuchar actualizaciones del viaje real en Supabase
  useEffect(() => {
    if (!tripId) return;

    const channel = supabase
      .channel(`public:trips:id=eq.${tripId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, (payload) => {
        console.log('Update de viaje:', payload.new);
        const updatedTrip = payload.new;
        if (updatedTrip.status === 'matched') {
          setMatchedDriverId(updatedTrip.driver_id);
          setStep('matched');
        } else if (updatedTrip.status === 'in_progress') {
          setStep('trip');
        } else if (updatedTrip.status === 'completed') {
          setStep('rate');
        } else if (updatedTrip.status === 'cancelled') {
          setStep('home');
          setTripId(null);
          setMatchedDriverId(null);
        }
      })
      .subscribe((status, err) => {
        if (err) console.error("Error realtime:", err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  // Sigue la posición real del conductor (driver_locations, la actualiza la
  // app de conductor por geolocalización) mientras va en camino o en viaje.
  useEffect(() => {
    if (!matchedDriverId || (step !== 'matched' && step !== 'trip')) return;

    supabase.from('driver_locations').select('location').eq('driver_id', matchedDriverId).single()
      .then(({ data }) => {
        const coords = data?.location?.coordinates;
        if (coords) setDriverLoc([coords[1], coords[0]]);
      });

    const channel = supabase
      .channel(`public:driver_locations:driver_id=eq.${matchedDriverId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${matchedDriverId}` }, (payload) => {
        const coords = payload.new?.location?.coordinates;
        if (coords) setDriverLoc([coords[1], coords[0]]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [matchedDriverId, step]);

  // Simulador visual de progreso para UI. Cuando no hay tripId real (modo
  // demo: se pidió un taxi pero no había conductores en línea para aceptar),
  // este mismo timer también hace avanzar los pasos solo, ya que no hay
  // conductor real actualizando el estado del viaje por realtime.
  useEffect(() => {
    let interval;
    if (step === 'matched') {
      interval = setInterval(() => {
        setPickupProg(p => {
          const next = p < 100 ? p + 5 : 100;
          if (next >= 100 && !tripId) setStep('trip');
          return next;
        });
      }, 1000);
    } else if (step === 'trip') {
      interval = setInterval(() => {
        setTripProg(p => {
          const next = p < 100 ? p + 2 : 100;
          if (next >= 100 && !tripId) setStep('rate');
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, tripId]);

  const shortcuts = [
    { name: "Terminal Marítimo", addr: "Cra. 1 #1-50, Comuna 3", glyph: "🏠", iconBg: "var(--sf2)" },
    { name: "Universidad del Pacífico", addr: "Km 13 vía Cabal Pombo", note: "Precios más bajos", glyph: "🎓", iconBg: "var(--jadeS)" }
  ];

  const vehicles = [
    { name: 'TurCarro', desc: 'Viaje cómodo y seguro', cap: '4', eta: '3 min', price: '$12.400', tone: '#444' },
    { name: 'TurMoto', desc: 'Llega más rápido', cap: '1', eta: '2 min', price: '$6.500', tone: '#222' },
    { name: 'TurVan', desc: 'Para grupos grandes', cap: '8', eta: '10 min', price: '$22.000', tone: '#666' }
  ];

  const handleRequestTrip = async () => {
    if (!selectedVehicle) return;
    setStep('searching');
    setPickupProg(0);
    setTripProg(0);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Inicia sesión primero");
        setStep('home');
        return;
      }

      // assign-driver crea el viaje, busca conductores cercanos y genera la
      // oferta (ventana de 12s) — un insert directo a `trips` deja el viaje
      // huérfano, sin trip_offer y sin conductor asignado.
      const { data, error } = await supabase.functions.invoke('assign-driver', {
        body: {
          pickup_lat: pickupLoc[0],
          pickup_lon: pickupLoc[1],
          dropoff_lat: dropoffLoc[0],
          dropoff_lon: dropoffLoc[1],
          pickup_address: pickupAddress,
          dropoff_address: dropoffAddress,
          category: selectedVehicle,
          payment_method: paymentMethod,
        },
      });

      if (error) {
        const body = await error.context?.json?.().catch(() => null);
        throw new Error(body?.error || error.message);
      }

      setTripId(data.trip_id);
      setTripPin(data.pin_code);

    } catch (err) {
      // Sin conductores en línea todavía (app de conductor en construcción):
      // en vez de cortar el flujo, se simula la aceptación para poder
      // probar el resto de las pantallas (matched/trip/rate). tripId queda
      // null a propósito — así el timer de progreso de arriba sabe que debe
      // avanzar los pasos solo, en lugar de esperar a un conductor real.
      if (err.message.includes('No hay conductores disponibles')) {
        setTimeout(() => setStep('matched'), 2500);
        return;
      }
      alert("Error al pedir viaje: " + err.message);
      setStep('home');
    }
  };

  const cancelTrip = async () => {
    if (!tripId) {
      setStep('home');
      return;
    }
    try {
      const { error } = await supabase.from('trips').update({ status: 'cancelled' }).eq('id', tripId);
      if (error) throw error;
      setTripId(null);
      setMatchedDriverId(null);
      setStep('home');
    } catch (err) {
      console.error("Error al cancelar:", err);
      alert("No se pudo cancelar el viaje");
    }
  };

  return (
    <>
      {step === 'home' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '46px 0 100px', animation: 'trFade .3s ease', background: 'var(--bg)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px' }}>
            <div style={{ width: '80px' }}></div> {/* Spacer for center alignment */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2.5px', flex: 1, justifyContent: 'center' }}>
              <div style={{ font: '800 23px/1 Manrope,sans-serif', letterSpacing: '-.05em', color: 'var(--tx)' }}>Turapp</div>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--jade)', marginBottom: '4px' }}></div>
            </div>
            <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={{ background: 'var(--jadeS)', color: 'var(--jade)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
            </div>
          </div>

          {/* Main Tabs */}
          <div style={{ display: 'flex', gap: '26px', justifyContent: 'center', padding: '0 16px', borderBottom: '1px solid var(--bd2)', marginBottom: '18px' }}>
            <button onClick={() => setTab('ride')} style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: tab === 'ride' ? '2px solid var(--tx)' : '2px solid transparent' }}>
              <img src="/images/car.png" alt="" style={{ width: '20px', objectFit: 'contain' }} />
              <div style={{ font: '700 16px Manrope,sans-serif', letterSpacing: '-.02em', color: tab === 'ride' ? 'var(--tx)' : 'var(--mu)' }}>Viaje</div>
            </button>
            <button onClick={() => setTab('send')} style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: tab === 'send' ? '2px solid var(--tx)' : '2px solid transparent' }}>
              <img src="/images/delivery_person.png" alt="" style={{ width: '20px', objectFit: 'contain' }} />
              <div style={{ font: '700 16px Manrope,sans-serif', letterSpacing: '-.02em', color: tab === 'send' ? 'var(--tx)' : 'var(--mu)' }}>Envíos</div>
            </button>
          </div>

          {tab === 'ride' ? (
            <>
              {/* Where to Input */}
              <div style={{ padding: '0 16px 24px' }}>
                <button onClick={() => setStep('address')} style={{ display: 'flex', alignItems: 'center', width: '100%', height: '64px', borderRadius: '99px', background: 'var(--sf)', padding: '0 8px 0 20px', gap: '12px' }}>
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><circle cx="7.8" cy="7.8" r="5.4" stroke="var(--tx)" strokeWidth="2.5"></circle><path d="m11.9 11.9 3.6 3.6" stroke="var(--tx)" strokeWidth="2.5" strokeLinecap="round"></path></svg>
                  <div style={{ flex: 1, textAlign: 'left', font: '700 20px Manrope,sans-serif', letterSpacing: '-.02em', color: 'var(--tx)' }}>¿A dónde vas?</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '48px', padding: '0 18px', borderRadius: '99px', background: 'var(--bg)', boxShadow: 'var(--sh2)' }}>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="3.2" width="12" height="11" rx="2.2" stroke="var(--tx)" strokeWidth="1.8"></rect><path d="M2 6.4h12M5.4 2v2.4M10.6 2v2.4" stroke="var(--tx)" strokeWidth="1.8" strokeLinecap="round"></path></svg>
                    <div style={{ font: '700 15px Manrope,sans-serif', color: 'var(--tx)' }}>Después</div>
                  </div>
                </button>
              </div>

              {/* For You */}
              <div style={{ padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ font: '800 21px Manrope,sans-serif', letterSpacing: '-.03em', color: 'var(--tx)' }}>Para ti</div>
                <button style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              </div>
              
              <div className="tr-sb" style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '0 16px 32px' }}>
                <button onClick={() => setStep('address')} style={{ flex: 'none', width: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '82px', height: '82px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/car.png" alt="" style={{ width: '64px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Taxi</div>
                </button>
                <button onClick={() => router.push('/cali')} style={{ flex: 'none', width: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '82px', height: '82px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/clock_car.png" alt="" style={{ width: '64px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Viajes a Cali</div>
                </button>
                <button style={{ flex: 'none', width: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '82px', height: '82px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/calendar.png" alt="" style={{ width: '56px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Reserva</div>
                </button>
                <button onClick={() => router.push('/services')} style={{ flex: 'none', width: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '82px', height: '82px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/delivery_person.png" alt="" style={{ width: '50px', objectFit: 'contain', marginLeft: '6px' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Tura favor</div>
                </button>
              </div>

              {/* Shortcuts */}
              <div style={{ padding: '0 16px', font: '800 21px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '16px', color: 'var(--tx)' }}>Atajos</div>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                
                <button onClick={() => setStep('select')} style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg)', border: '1px solid var(--bd2)', textAlign: 'left', boxShadow: 'var(--sh2)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 16px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Terminal Marítimo</div>
                    <div style={{ font: '500 13px/1.4 Manrope,sans-serif', color: 'var(--mu)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Cra. 1 #1-50, Comuna 3, Buenaventura</div>
                  </div>
                </button>

                <button onClick={() => setStep('select')} style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg)', border: '1px solid var(--bd2)', textAlign: 'left', boxShadow: 'var(--sh2)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--jadeS)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--jade)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 16px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Universidad del Pacífico</div>
                    <div style={{ font: '500 13px/1.4 Manrope,sans-serif', color: 'var(--mu)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Km 13 vía Cabal Pombo · Precios más bajos de lo normal</div>
                    <div style={{ font: '600 13px Manrope,sans-serif', color: 'var(--jade)', marginTop: '4px' }}>Precios más bajos</div>
                  </div>
                </button>

                <button onClick={() => setStep('address')} style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg)', border: '1px solid var(--bd2)', textAlign: 'left', boxShadow: 'var(--sh2)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 16px Manrope,sans-serif', color: 'var(--tx)' }}>Guardar un lugar</div>
                  </div>
                </button>

              </div>
              
              <div style={{ padding: '0 16px', font: '800 21px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '16px', color: 'var(--tx)' }}>Servicios</div>
              <div className="tr-sb" style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '0 16px 24px' }}>
                <button onClick={() => router.push('/services')} style={{ flex: 'none', width: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '82px', height: '82px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/delivery_person.png" alt="" style={{ width: '64px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Enviar paquete</div>
                </button>
                <button onClick={() => router.push('/services')} style={{ flex: 'none', width: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '82px', height: '82px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/moto.png" alt="" style={{ width: '64px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Tura favor</div>
                </button>
                <button onClick={() => setStep('select')} style={{ flex: 'none', width: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '82px', height: '82px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/clock_car.png" alt="" style={{ width: '64px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Reserva</div>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Envíos Content */}
              <div style={{ padding: '0 16px 24px' }}>
                <button onClick={() => router.push('/services')} style={{ display: 'flex', alignItems: 'center', width: '100%', height: '64px', borderRadius: '99px', background: 'var(--sf)', padding: '0 8px 0 20px', gap: '12px' }}>
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none"><circle cx="7.8" cy="7.8" r="5.4" stroke="var(--tx)" strokeWidth="2.5"></circle><path d="m11.9 11.9 3.6 3.6" stroke="var(--tx)" strokeWidth="2.5" strokeLinecap="round"></path></svg>
                  <div style={{ flex: 1, textAlign: 'left', font: '700 20px Manrope,sans-serif', letterSpacing: '-.02em', color: 'var(--tx)' }}>Enviar un paquete</div>
                </button>
              </div>

              <div style={{ padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ font: '800 21px Manrope,sans-serif', letterSpacing: '-.03em', color: 'var(--tx)' }}>Opciones de envío</div>
              </div>
              
              <div className="tr-sb" style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '0 16px 32px' }}>
                <button onClick={() => router.push('/services')} style={{ flex: 'none', width: '96px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/delivery_person.png" alt="" style={{ width: '64px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Enviar</div>
                </button>
                <button onClick={() => router.push('/services')} style={{ flex: 'none', width: '96px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/delivery_person.png" alt="" style={{ width: '64px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Recibir</div>
                </button>
                <button onClick={() => router.push('/services')} style={{ flex: 'none', width: '96px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 -4px 10px rgba(0,0,0,0.03)' }}>
                    <img src="/images/moto.png" alt="" style={{ width: '64px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ font: '700 13px/1.2 Manrope,sans-serif', textAlign: 'center', color: 'var(--tx)' }}>Tura favor</div>
                </button>
              </div>

              <div style={{ padding: '0 16px', marginBottom: '32px' }}>
                <button onClick={() => router.push('/services')} style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--bg)', border: '1px solid var(--bd2)', textAlign: 'left', boxShadow: 'var(--sh2)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 16px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Ver todos los servicios de envío</div>
                    <div style={{ font: '500 13px/1.4 Manrope,sans-serif', color: 'var(--mu)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Paquetes, mandados y más</div>
                  </div>
                </button>
              </div>
            </>
          )}

          <BottomNav />
        </div>
      )}

      {step === 'address' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)', background: 'var(--bg)' }}>
          <div style={{ padding: '40px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <button onClick={() => setStep('home')} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </button>
              <div style={{ flex: 1, textAlign: 'center', font: '700 18px Manrope,sans-serif', color: 'var(--tx)', marginRight: '36px' }}>Plan your ride</div>
            </div>
            
            <div style={{ display: 'flex', border: '2px solid var(--tx)', borderRadius: '16px', padding: '16px 12px', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: '16px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--tx)', marginTop: '6px' }}></div>
                <div style={{ flex: 1, width: '2px', background: 'var(--tx)', margin: '4px 0' }}></div>
                <div style={{ width: '8px', height: '8px', border: '2px solid var(--tx)', marginBottom: '6px' }}></div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ font: '400 12px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '4px' }}>Pickup</div>
                  <input
                    value={activeField === 'pickup' ? pickupQuery : pickupAddress}
                    onFocus={() => { setActiveField('pickup'); setPickupQuery(''); }}
                    onChange={(e) => setPickupQuery(e.target.value)}
                    placeholder="¿Dónde te recogemos?"
                    style={{ width: '100%', font: '600 16px Manrope,sans-serif', color: 'var(--tx)', background: 'none', border: 'none', outline: 'none', padding: 0 }}
                  />
                </div>
                <div>
                  <div style={{ font: '400 12px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '4px' }}>Destination</div>
                  <input
                    autoFocus={activeField === 'destination'}
                    value={destinationQuery}
                    onFocus={() => setActiveField('destination')}
                    onChange={(e) => setDestinationQuery(e.target.value)}
                    placeholder="¿A dónde vas?"
                    style={{ width: '100%', font: '400 16px Manrope,sans-serif', color: 'var(--tx)', borderLeft: '2px solid var(--jade)', paddingLeft: '4px', background: 'none', border: 'none', borderLeftWidth: '2px', borderLeftColor: 'var(--jade)', borderLeftStyle: 'solid', outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="tr-sb" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {activeField === 'pickup' && pickupQuery.trim().length >= 2 ? (
              <>
                <div style={{ font: '700 18px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '16px' }}>
                  {pickupSearching ? 'Buscando...' : `Resultados para "${pickupQuery}"`}
                </div>
                {!pickupSearching && pickupResults.length === 0 && (
                  <div style={{ font: '500 14px Manrope,sans-serif', color: 'var(--mu)' }}>No encontramos nada en Buenaventura. Prueba con otro nombre.</div>
                )}
                {pickupResults.map((r, idx) => (
                  <button key={idx} onClick={() => handleSelectPickup(r)} style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '14px 0', textAlign: 'left', borderBottom: '1px solid var(--sf)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 15px Manrope,sans-serif', color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{splitAddress(r.display_name).primary}</div>
                      <div style={{ font: '400 12.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{splitAddress(r.display_name).secondary}</div>
                    </div>
                  </button>
                ))}
              </>
            ) : activeField === 'destination' && destinationQuery.trim().length >= 2 ? (
              <>
                <div style={{ font: '700 18px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '16px' }}>
                  {destinationSearching ? 'Buscando...' : `Resultados para "${destinationQuery}"`}
                </div>
                {!destinationSearching && destinationResults.length === 0 && (
                  <div style={{ font: '500 14px Manrope,sans-serif', color: 'var(--mu)' }}>No encontramos nada en Buenaventura. Prueba con otro nombre.</div>
                )}
                {destinationResults.map((r, idx) => (
                  <button key={idx} onClick={() => handleSelectDestination(r)} style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '14px 0', textAlign: 'left', borderBottom: '1px solid var(--sf)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><circle cx="12" cy="10" r="3"/><path d="M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11z"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 15px Manrope,sans-serif', color: 'var(--tx)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{splitAddress(r.display_name).primary}</div>
                      <div style={{ font: '400 12.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{splitAddress(r.display_name).secondary}</div>
                    </div>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div style={{ font: '700 18px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '16px' }}>Selecciona un destino</div>

                <button style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '12px 0', borderBottom: '1px solid var(--sf)' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--tx)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                  <div style={{ font: '600 16px Manrope,sans-serif', color: 'var(--tx)' }}>Lugares guardados</div>
                </button>

                {shortcuts.map((a, idx) => (
                  <button key={idx} onClick={() => { setDropoffAddress(a.name); setStep('select'); }} style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%', padding: '16px 0', textAlign: 'left', borderBottom: '1px solid var(--sf)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 16px Manrope,sans-serif', color: 'var(--tx)' }}>{a.name}</div>
                      <div style={{ font: '400 14px Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.addr}</div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {step === 'select' && (
        <div style={{ position: 'absolute', inset: 0, animation: 'trFade .3s ease', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: 'var(--sf)', zIndex: 0, opacity: 0.6 }}>
            <Map center={pickupLoc} zoom={19} markers={[{ position: pickupLoc, popup: 'Punto de recogida' }]} />
          </div>
          
          <div style={{ paddingTop: '40px', paddingBottom: '16px', background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 80%, rgba(255,255,255,0) 100%)', zIndex: 10, display: 'flex', alignItems: 'center', paddingLeft: '16px' }}>
            <button onClick={() => setStep('address')} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div style={{ flex: 1, textAlign: 'center', font: '600 14px Manrope,sans-serif', color: 'var(--tx)', marginRight: '36px' }}>IKY Yoga Center → ApartaEstudios...</div>
          </div>
          
          <div style={{ flex: 1 }}></div>

          <div style={{ background: 'var(--bg)', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', zIndex: 10, display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', flexShrink: 0, maxHeight: '75vh', paddingBottom: '24px' }}>
            <div style={{ width: '40px', height: '4px', background: '#e0e0e0', borderRadius: '2px', margin: '12px auto', flexShrink: 0 }}></div>
            
            <div className="tr-sb" style={{ flex: 1, overflowY: 'auto', padding: '0 16px', minHeight: 0 }}>
              
              {/* Taxi */}
              <button onClick={() => setSelectedVehicle('taxi')} style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '16px', margin: '8px 0', borderRadius: '16px', border: selectedVehicle === 'taxi' ? '2px solid var(--tx)' : '2px solid transparent', background: selectedVehicle === 'taxi' ? 'var(--sf)' : 'transparent', textAlign: 'left', transition: 'all 0.2s ease' }}>
                <img src="/images/car.png" style={{ width: '64px', height: '64px', objectFit: 'contain', flex: 'none', marginRight: '12px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ font: '700 16px Manrope,sans-serif', color: 'var(--tx)' }}>Taxi</div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                    <div style={{ font: '600 12px Manrope,sans-serif' }}>4</div>
                  </div>
                  <div style={{ font: '400 13px Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px' }}>en 5 min • 10:18</div>
                  <div style={{ font: '400 13px Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px' }}>Rápido y confiable · taxímetro Decreto 0048/2026</div>
                </div>
                <div style={{ font: '700 18px Manrope,sans-serif', color: 'var(--tx)' }}>${taxiFare.toLocaleString('es-CO')}</div>
              </button>

              {/* Particular */}
              <div onClick={() => setSelectedVehicle('particular')} style={{ width: '100%', padding: '16px', margin: '8px 0', borderRadius: '16px', border: selectedVehicle === 'particular' ? '2px solid var(--tx)' : '2px solid transparent', background: selectedVehicle === 'particular' ? 'var(--sf)' : 'transparent', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <img src="/images/car.png" style={{ width: '64px', height: '64px', objectFit: 'contain', flex: 'none', marginRight: '12px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', background: 'var(--jade)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--bg)" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg></div>
                        <div style={{ font: '700 16px Manrope,sans-serif', color: 'var(--tx)' }}>Particular</div>
                      </div>
                      <div style={{ background: 'var(--jadeS)', color: 'var(--jade)', padding: '4px 8px', borderRadius: '4px', font: '600 12px Manrope,sans-serif' }}>Negociable</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedVehicle('particular'); setParticularOffer(p => Math.max(CARRERA_MINIMA, (p ?? particularBase) - 500)); }} style={{ width: '48px', height: '32px', borderRadius: '16px', border: '1px solid #e0e0e0', font: '600 14px Manrope,sans-serif' }}>-500</button>
                      <div style={{ font: '700 20px Manrope,sans-serif', color: 'var(--tx)' }}>${particularFare.toLocaleString('es-CO')}</div>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedVehicle('particular'); setParticularOffer(p => (p ?? particularBase) + 500); }} style={{ width: '48px', height: '32px', borderRadius: '16px', border: '1px solid #e0e0e0', font: '600 14px Manrope,sans-serif' }}>+500</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div style={{ padding: '16px', borderTop: '1px solid var(--sf)', flexShrink: 0 }}>
              <button onClick={() => setStep('paywith')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: paymentMethod === 'cash' ? 'var(--tx)' : 'var(--inv)', color: 'var(--bg)', font: '800 10px sans-serif', padding: '2px 6px', borderRadius: '4px' }}>
                    {PAYMENT_METHOD_ICON[paymentMethod] || '💵'}
                  </div>
                  <div style={{ font: '600 15px Manrope,sans-serif', color: 'var(--tx)' }}>{PAYMENT_METHOD_LABEL[paymentMethod] || 'Efectivo'}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              <button onClick={handleRequestTrip} disabled={!selectedVehicle} style={{ width: '100%', height: '56px', background: selectedVehicle ? 'var(--tx)' : 'var(--sf2)', color: selectedVehicle ? 'var(--bg)' : 'var(--mu)', borderRadius: '12px', font: '700 18px Manrope,sans-serif', transition: 'all 0.2s ease' }}>
                {selectedVehicle ? `Confirmar viaje · $${(selectedVehicle === 'taxi' ? taxiFare : particularFare).toLocaleString('es-CO')}` : 'Elige un vehículo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'paywith' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '50px 20px 30px', animation: 'trFade .28s ease', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 18px' }}>
            <button onClick={() => setStep('select')} style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round"></path></svg>
            </button>
          </div>
          <div style={{ font: '800 32px/1 Manrope,sans-serif', letterSpacing: '-.045em', marginBottom: '20px' }}>Opciones de pago</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '34px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '9px', background: 'var(--inv)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', font: '800 11px Manrope,sans-serif', color: 'var(--invtx)', letterSpacing: '-.03em' }}>Tur</div>
            <div style={{ flex: 1, font: '600 15px Manrope,sans-serif' }}>Turapp Cash: COP 24.500</div>
          </div>
          <div style={{ font: '800 20px Manrope,sans-serif', letterSpacing: '-.035em', marginBottom: '16px' }}>Métodos de pago</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button onClick={() => setPaymentMethod('cash')} style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', padding: '15px 0', textAlign: 'left', borderBottom: '1px solid var(--bd2)' }}>
              <div style={{ width: '38px', height: '26px', borderRadius: '5px', background: 'var(--tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px Manrope,sans-serif', color: 'var(--bg)', flex: 'none', letterSpacing: '.03em' }}>💵</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: '600 15px Manrope,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Efectivo</div></div>
              {paymentMethod === 'cash' && (
                <div style={{ width: '23px', height: '23px', borderRadius: '50%', background: 'var(--tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.6 6.2 4.8 8.4 9.4 3.6" stroke="var(--bg)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                </div>
              )}
            </button>
            {savedPaymentMethods.map((m) => (
              <button key={m.id} onClick={() => setPaymentMethod(m.type)} style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', padding: '15px 0', textAlign: 'left', borderBottom: '1px solid var(--bd2)' }}>
                <div style={{ width: '38px', height: '26px', borderRadius: '5px', background: 'var(--inv)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 8.5px Manrope,sans-serif', color: 'var(--bg)', flex: 'none', letterSpacing: '.03em' }}>{PAYMENT_METHOD_ICON[m.type]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 15px Manrope,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</div>
                  {m.phone_number && <div style={{ font: '500 11.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: '1px' }}>{m.phone_number}</div>}
                </div>
                {paymentMethod === m.type && (
                  <div style={{ width: '23px', height: '23px', borderRadius: '50%', background: 'var(--tx)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.6 6.2 4.8 8.4 9.4 3.6" stroke="var(--bg)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                  </div>
                )}
              </button>
            ))}
            <button onClick={() => router.push('/account')} style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', padding: '15px 0', textAlign: 'left' }}>
              <div style={{ width: '38px', height: '26px', borderRadius: '5px', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              </div>
              <div style={{ font: '600 15px Manrope,sans-serif', color: 'var(--mu)' }}>Agregar Nequi, Daviplata o tarjeta</div>
            </button>
          </div>
          <button onClick={() => setStep('select')} style={{ height: '54px', borderRadius: '13px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 16px Manrope,sans-serif', width: '100%', marginTop: '26px' }}>Listo</button>
        </div>
      )}

      {step === 'searching' && (
        <div style={{ position: 'absolute', inset: 0, animation: 'trFade .3s ease' }}>
          
          {/* iOS Dynamic Island Notification Expansion */}
          <div style={{ 
            position: 'absolute', 
            top: '12px', 
            left: '50%', 
            transform: 'translateX(-50%)', 
            width: '360px', 
            background: '#000', 
            borderRadius: '35px', 
            zIndex: 10000,
            padding: '16px 20px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            animation: 'trPop .4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--jade)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <img src="/images/car.png" alt="" style={{ width: '28px', filter: 'brightness(0) invert(1)' }} />
            </div>
            <div style={{ flex: 1 }}>
               <div style={{ font: '600 15px Manrope,sans-serif', marginBottom: '2px' }}>Viaje solicitado</div>
               <div style={{ font: '500 13px Manrope,sans-serif', color: 'rgba(255,255,255,0.7)' }}>Buscando al mejor conductor...</div>
            </div>
            <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'trSpin 1s linear infinite' }}></div>
          </div>

          <div style={{ position: 'absolute', inset: 0, bottom: '130px' }}>
            <Map center={pickupLoc} zoom={19} markers={[{ position: pickupLoc, popup: 'Origen' }]} />
          </div>
          <div className="tr-sb" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70dvh', overflowY: 'auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '20px 20px 28px', boxShadow: 'var(--sh)', animation: 'trUpS .34s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: '2.5px solid var(--bd)', borderTopColor: 'var(--jade)', animation: 'trSpin .85s linear infinite', flex: 'none' }}></div>
              <div style={{ flex: 1 }}><div style={{ font: '800 18px Manrope,sans-serif', letterSpacing: '-.03em' }}>Buscando conductor...</div><div style={{ font: '500 12.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px' }}>Esto tomará unos segundos.</div></div>
            </div>
            <button onClick={cancelTrip} style={{ height: '50px', borderRadius: '13px', background: 'var(--sf)', font: '700 15px Manrope,sans-serif', width: '100%' }}>Cancelar</button>
          </div>
        </div>
      )}

      {step === 'matched' && (
        <div style={{ position: 'absolute', inset: 0, animation: 'trFade .3s ease' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '474px', overflow: 'hidden', background: '#e0e0e0' }}>
            <Map center={driverLoc} zoom={19} markers={[{ position: driverLoc, popup: 'Conductor' }, { position: pickupLoc, popup: 'Tú' }]} />
          </div>
          <div style={{ position: 'absolute', top: '54px', left: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '14px', background: 'var(--bg)', boxShadow: 'var(--sh)', zIndex: 20 }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--jade)', animation: 'trRing 1.6s ease-out infinite', flex: 'none' }}></div>
            <div style={{ flex: 1, font: '700 14px Manrope,sans-serif' }}>El conductor va en camino</div>
            <div style={{ font: "800 14px 'IBM Plex Mono',monospace", color: 'var(--jade)' }}>3 min</div>
          </div>
          <div className="tr-sb" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70dvh', overflowY: 'auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--sh)', animation: 'trUpS .34s cubic-bezier(.2,.8,.2,1)', paddingBottom: '24px' }}>
            <div style={{ padding: '9px 0 2px', display: 'flex', justifyContent: 'center' }}><div style={{ width: '38px', height: '4px', borderRadius: '3px', background: 'var(--bd)' }}></div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '12px 18px 16px' }}>
              <div style={{ position: 'relative', flex: 'none' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 16px Manrope,sans-serif' }}>YM</div>
                <div style={{ position: 'absolute', bottom: '-3px', right: '-4px', display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 6px', borderRadius: '99px', background: 'var(--tx)' }}>
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M5 .8l1.3 2.7 3 .4-2.2 2.1.5 3L5 7.6 2.4 9l.5-3L.7 3.9l3-.4L5 .8Z" fill="var(--bg)"></path></svg>
                  <div style={{ font: '700 8.5px Manrope,sans-serif', color: 'var(--bg)' }}>4.92</div>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 16px Manrope,sans-serif', letterSpacing: '-.025em' }}>Yeison Mosquera</div>
                <div style={{ font: '500 12.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: '1px' }}>Chevrolet Spark GT · Gris</div>
              </div>
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div style={{ display: 'inline-flex', padding: '5px 9px', borderRadius: '7px', background: 'var(--tx)', color: 'var(--bg)', font: "600 14px/1 'IBM Plex Mono',monospace", letterSpacing: '.06em' }}>WBC41D</div>
                <div style={{ font: '500 10px Manrope,sans-serif', color: 'var(--mu)', marginTop: '4px' }}>Placa</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', margin: '0 18px 14px', padding: '12px 14px', borderRadius: '12px', background: 'var(--jadeS)' }}>
              <div style={{ font: "600 12px 'IBM Plex Mono',monospace", color: 'var(--jade)', letterSpacing: '.1em', flex: 'none' }}>PIN {tripPin || '····'}</div>
              <div style={{ flex: 1, font: '500 11.5px/1.4 Manrope,sans-serif', color: 'var(--jade)', opacity: .9 }}>Dale este PIN al conductor al subirte para tu seguridad.</div>
            </div>
            <div style={{ display: 'flex', gap: '9px', padding: '0 18px' }}>
              <button onClick={cancelTrip} style={{ flex: 1, height: '50px', borderRadius: '12px', background: 'var(--sf)', font: '700 14.5px Manrope,sans-serif', color: 'var(--red)' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {step === 'trip' && (
        <div style={{ position: 'absolute', inset: 0, animation: 'trFade .3s ease' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '580px', overflow: 'hidden', background: '#e0e0e0' }}>
            <Map center={driverLoc} zoom={17} markers={[{ position: pickupLoc, popup: 'Origen' }, { position: dropoffLoc, popup: 'Destino' }, { position: driverLoc, popup: 'Conductor' }]} />
          </div>
          <div style={{ position: 'absolute', top: '54px', left: '16px', right: '16px', padding: '14px 16px', borderRadius: '15px', background: 'var(--bg)', boxShadow: 'var(--sh)', zIndex: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--jade)', animation: 'trBlink 1.4s ease-in-out infinite', flex: 'none' }}></div>
              <div style={{ flex: 1, font: '700 14px Manrope,sans-serif' }}>En viaje</div>
              <div style={{ font: "800 14px 'IBM Plex Mono',monospace" }}>12 min</div>
            </div>
            <div style={{ height: '5px', borderRadius: '3px', background: 'var(--sf2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '3px', background: 'var(--jade)', width: `${tripProg}%`, transition: 'width 1s linear' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '7px', font: '500 11px Manrope,sans-serif', color: 'var(--mu)', whiteSpace: 'nowrap' }}>
              <div>{pickupAddress}</div><div>{dropoffAddress}</div>
            </div>
          </div>
          <div className="tr-sb" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70dvh', overflowY: 'auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', boxShadow: 'var(--sh)', padding: '16px 18px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 14px Manrope,sans-serif', flex: 'none' }}>YM</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: '700 15px Manrope,sans-serif' }}>Yeison Mosquera</div><div style={{ font: '500 12px Manrope,sans-serif', color: 'var(--mu)' }}>WBC41D · Spark GT</div></div>
            </div>
            <div style={{ display: 'flex', gap: '9px' }}>
              <div style={{ flex: 1, height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 14px Manrope,sans-serif', color: 'var(--mu)' }}>Viaje en curso...</div>
            </div>
          </div>
        </div>
      )}

      {step === 'rate' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '56px 20px 30px', animation: 'trFade .3s ease', background: 'var(--bg)' }}>
          <button onClick={() => setStep('home')} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M10.5 3.5 5.5 8.5l5 5" stroke="var(--tx)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </button>
          <div style={{ font: '800 27px/1.12 Manrope,sans-serif', letterSpacing: '-.04em', marginBottom: '8px' }}>Has llegado a tu destino</div>
          <div style={{ font: '500 13.5px/1.5 Manrope,sans-serif', color: 'var(--mu)', marginBottom: '32px' }}>¿Qué tal estuvo tu viaje con Yeison?</div>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px' }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="34" height="34" viewBox="0 0 34 34" fill="none"><path d="M17 2.8l4.3 9.4 10.3 1.1-7.7 7 2.2 10.1-9-5.1-9.1 5.1 2.2-10.1-7.7-7 10.3-1.1L17 2.8Z" fill={s <= 4 ? "var(--amber)" : "var(--sf2)"} stroke={s <= 4 ? "var(--amber)" : "var(--sf2)"} strokeWidth="2" strokeLinejoin="round"></path></svg>
              </button>
            ))}
          </div>
          
          <div style={{ font: '800 18px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '14px' }}>Dale una propina</div>
          <div style={{ display: 'flex', gap: '9px', marginBottom: '28px' }}>
            <button style={{ flex: 1, height: '44px', borderRadius: '99px', background: 'var(--sf)', font: "700 14px 'IBM Plex Mono',monospace" }}>$1.000</button>
            <button style={{ flex: 1, height: '44px', borderRadius: '99px', background: 'var(--inv)', color: 'var(--invtx)', font: "700 14px 'IBM Plex Mono',monospace" }}>$2.000</button>
            <button style={{ flex: 1, height: '44px', borderRadius: '99px', background: 'var(--sf)', font: "700 14px 'IBM Plex Mono',monospace" }}>$3.000</button>
          </div>
          <button onClick={() => setStep('home')} style={{ height: '54px', borderRadius: '13px', background: 'var(--sf)', font: '700 16px Manrope,sans-serif', width: '100%', marginBottom: '16px' }}>Omitir</button>
          <button onClick={() => setStep('home')} style={{ height: '54px', borderRadius: '13px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 16px Manrope,sans-serif', width: '100%' }}>Enviar calificación</button>
        </div>
      )}
    </>
  );
}

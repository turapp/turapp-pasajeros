'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '../../components/BottomNav';
import { supabase } from '../../lib/supabaseClient';
import { turaFavorServiceFee, taxiEstimatedFare, haversineKm } from '../../lib/pricing';

export default function ServicesPage() {
  const router = useRouter();
  const [step, setStep] = useState('services'); // services, serviceDetail, package, schedule, favor

  const [favorType, setFavorType] = useState('Comprar');
  const [favorDescription, setFavorDescription] = useState('');
  const [favorBudget, setFavorBudget] = useState(20000);
  const [favorLoading, setFavorLoading] = useState(false);
  const [favorError, setFavorError] = useState(null);

  // Piso legal (Carrera Mínima, Decreto 0048/2026) + margen de servicio de Turapp
  const favorServiceFee = turaFavorServiceFee();

  // La tabla favors solo acepta estos 4 valores (CHECK constraint)
  const FAVOR_TYPE_MAP = {
    'Comprar': 'buy',
    'Hacer fila': 'queue',
    'Recoger': 'pickup',
    'Otro': 'deliver',
  };

  const PACKAGE_TYPE_MAP = { 'Documentos': 'documents', 'Comida': 'food', 'Llaves y objetos': 'keys_items', 'Compra en tienda': 'store_purchase' };
  // Los mismos precios que quedaron en app_settings (favor_sobre, favor_paquete,
  // favor_grande). Aquí decían 6.200 / 8.300, así que el pasajero veía un
  // precio y el conductor cobraba otro.
  const PACKAGE_SIZE_MAP = {
    'Sobre': { code: 'envelope', price: 6900 },
    'Caja pequeña': { code: 'small_box', price: 9900 },
    'Caja grande': { code: 'large_box', price: 14900 },
  };
  const [packageType, setPackageType] = useState('Documentos');
  const [packageSize, setPackageSize] = useState('Sobre');
  // Venían con una persona inventada precargada. Quien no leyera el formulario
  // mandaba el paquete a nombre y teléfono de alguien que no existe.
  const [senderAddress, setSenderAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [packageLoading, setPackageLoading] = useState(false);
  const [packageError, setPackageError] = useState(null);

  const scheduleDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { date: d, dow: d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '').toUpperCase(), num: d.getDate() };
  });
  const [scheduledDayIndex, setScheduledDayIndex] = useState(0);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);

  // La reserva mandaba SIEMPRE Terminal Marítimo → Centro a las 6:30 a.m. por
  // $19.700, sin importar lo que el pasajero quisiera: el único control era
  // escoger el día. Confirmaba "tu reserva" y creaba un viaje ajeno.
  const HORAS_RESERVA = ['05:00', '06:00', '06:30', '07:00', '08:00', '09:00', '12:00', '15:00', '17:00', '19:00'];
  const [scheduleHora, setScheduleHora] = useState('06:30');
  const [origen, setOrigen] = useState(null);      // { nombre, lat, lon }
  const [destino, setDestino] = useState(null);
  const [campo, setCampo] = useState(null);        // 'origen' | 'destino'
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(busqueda)}`);
        setResultados(await res.json());
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cuandoSale = () => {
    const [h, m] = scheduleHora.split(':').map(Number);
    const d = new Date(scheduleDays[scheduledDayIndex].date);
    d.setHours(h, m, 0, 0);
    return d;
  };

  // Precio con la tarifa real: Carrera Mínima del Decreto 0048 con sus
  // recargos de noche y de domingo/festivo, más la distancia.
  const kmReserva = origen && destino
    ? haversineKm([origen.lat, origen.lon], [destino.lat, destino.lon])
    : 0;
  const precioReserva = taxiEstimatedFare(kmReserva, cuandoSale());

  const handleConfirmSchedule = async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Debes iniciar sesión');

      if (!origen || !destino) throw new Error('Dinos de dónde te recogemos y para dónde vas.');

      const scheduledFor = cuandoSale();
      if (scheduledFor <= new Date()) throw new Error('Esa hora ya pasó. Escoge otra o programa para mañana.');

      // No pasa por assign-driver: es una reserva a futuro, no se busca conductor
      // todavía. La ventana de confirmación (30 min antes) queda pendiente de un
      // job programado que aún no existe.
      const { error } = await supabase.from('trips').insert({
        rider_id: user.id,
        category: 'taxi',
        status: 'requested',
        scheduled_for: scheduledFor.toISOString(),
        pickup_location: `SRID=4326;POINT(${origen.lon} ${origen.lat})`,
        pickup_address: origen.nombre,
        dropoff_location: `SRID=4326;POINT(${destino.lon} ${destino.lat})`,
        dropoff_address: destino.nombre,
        fare_estimated: precioReserva,
        payment_method: 'cash',
      });

      if (error) throw error;

      alert(`Reserva confirmada para el ${scheduledFor.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${scheduleHora}. Te confirmamos conductor 30 minutos antes.`);
      setStep('services');
    } catch (err) {
      setScheduleError(err.message || 'No se pudo confirmar la reserva');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleRequestPackage = async () => {
    setPackageLoading(true);
    setPackageError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No has iniciado sesión');

      if (!senderAddress.trim()) throw new Error('Falta dónde recogemos el paquete.');
      if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
        throw new Error('Falta quién recibe: nombre, teléfono y dirección.');
      }

      const sizeInfo = PACKAGE_SIZE_MAP[packageSize];
      const { error } = await supabase.from('packages').insert({
        rider_id: user.id,
        package_type: PACKAGE_TYPE_MAP[packageType] || 'documents',
        size: sizeInfo.code,
        price: sizeInfo.price,
        // Decía literalmente "Ubicación actual del remitente": el conductor
        // aceptaba la encomienda sin saber a dónde ir a recogerla.
        pickup_address: senderAddress,
        dropoff_address: recipientAddress,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
      });

      if (error) throw error;

      alert('¡Buscando repartidor para tu paquete!');
      router.push('/home');
    } catch (err) {
      setPackageError(err.message || 'Error al enviar el paquete');
    } finally {
      setPackageLoading(false);
    }
  };

  const handleRequestFavor = async () => {
    setFavorLoading(true);
    setFavorError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No has iniciado sesión');

      const description = favorDescription || 'Comprar leche y pan';
      const { error } = await supabase
        .from('favors')
        .insert({
          rider_id: user.id,
          favor_type: FAVOR_TYPE_MAP[favorType] || 'buy',
          description: `${description}\n\nDónde es: Éxito Buenaventura · Calle 7\nDónde entregarlo: Calle 6 #3-24, Comuna 4`,
          max_budget: favorBudget,
          service_fee: favorServiceFee,
        });

      if (error) throw error;
      
      alert('¡Tura favor solicitado con éxito!');
      router.push('/home');
    } catch (err) {
      setFavorError(err.message || 'Error al solicitar el favor');
    } finally {
      setFavorLoading(false);
    }
  };

  const svcCards = [
    { 
      name: 'Taxi / Particular', 
      desc: 'Taxi autorizado con taxímetro, o carro de placa blanca a precio fijo.', 
      img: '/images/car.png', 
      badge: 'AUTORIZADO',
      go: () => setStep('serviceDetail')
    },
    { 
      name: 'Viajes a Cali', 
      desc: 'Salidas cada 2 horas. Reserva tu puesto pagando solo el 30% y el resto al subir.', 
      img: '/images/clock_car.png', 
      badge: 'ABONO 30%',
      go: () => router.push('/cali')
    },
    { 
      name: 'Reserva', 
      desc: 'Reserva tu viaje con anticipación para que puedas relajarte ese día.', 
      img: '/images/calendar.png', 
      badge: '',
      go: () => setStep('schedule')
    },
    { 
      name: 'Tura favor', 
      desc: 'Alguien hace el mandado por ti: lo compra, hace la fila o lo recoge.', 
      img: '/images/moto.png', 
      badge: 'NUEVO',
      go: () => setStep('favor')
    }
  ];

  const svcSendCards = [
    {
      name: 'Tura favor',
      desc: 'Pide lo que sea: una fila, una compra, una vuelta. Alguien lo hace por ti.',
      img: '/images/moto.png',
      go: () => setStep('favor')
    },
    {
      name: 'Enviar paquete',
      desc: 'Elige el tipo de paquete y envíalo el mismo día en carros y taxis autorizados.',
      img: '/images/delivery_person.png',
      go: () => setStep('package')
    },
    {
      name: 'Encomienda a Cali',
      desc: 'Envía una encomienda por la ruta intermunicipal en carro de placa blanca.',
      img: '/images/car.png',
      go: () => router.push('/cali')
    },
    {
      name: 'Programar',
      desc: 'Elige el día y la ventana de recogida de tu envío.',
      img: '/images/calendar.png',
      go: () => setStep('schedule')
    }
  ];

  return (
    <>
      {step === 'services' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '60px 16px 100px', background: 'var(--bg)', animation: 'trFade .3s ease' }}>
          <div style={{ font: '800 30px/1.1 Manrope,sans-serif', letterSpacing: '-0.04em', color: 'var(--tx)', marginBottom: '28px' }}>Explora lo que puedes hacer con Turapp</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {svcCards.map((card, idx) => (
              <button key={idx} onClick={card.go} style={{ position: 'relative', width: '100%', background: 'var(--sf)', borderRadius: '20px', padding: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '8px' }}>
                  <div style={{ font: '700 18px Manrope,sans-serif', color: 'var(--tx)' }}>{card.name}</div>
                  {card.badge && (
                    <div style={{ background: 'var(--jade)', color: '#fff', font: '800 10px Manrope,sans-serif', padding: '4px 8px', borderRadius: '99px', letterSpacing: '0.03em' }}>{card.badge}</div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '8px', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ font: '500 13.5px/1.45 Manrope,sans-serif', color: 'var(--mu)', marginBottom: '16px' }}>{card.desc}</div>
                    <div>
                      <div style={{ display: 'inline-flex', background: 'var(--bg)', color: 'var(--tx)', padding: '10px 18px', borderRadius: '99px', font: '700 13px Manrope,sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        Detalles
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={card.img} alt="" style={{ width: '80px', objectFit: 'contain' }} />
                  </div>
                </div>

              </button>
            ))}
          </div>

          <div style={{ font: '800 24px/1.1 Manrope,sans-serif', letterSpacing: '-0.04em', color: 'var(--tx)', marginTop: '36px', marginBottom: '24px' }}>Envía lo que sea</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {svcSendCards.map((card, idx) => (
              <button key={idx} onClick={card.go} style={{ position: 'relative', width: '100%', background: 'var(--sf)', borderRadius: '20px', padding: '20px', textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                
                <div style={{ font: '700 18px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '8px' }}>{card.name}</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '8px', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ font: '500 13.5px/1.45 Manrope,sans-serif', color: 'var(--mu)', marginBottom: '16px' }}>{card.desc}</div>
                    <div>
                      <div style={{ display: 'inline-flex', background: 'var(--bg)', color: 'var(--tx)', padding: '10px 18px', borderRadius: '99px', font: '700 13px Manrope,sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        Detalles
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img src={card.img} alt="" style={{ width: '80px', objectFit: 'contain' }} />
                  </div>
                </div>

              </button>
            ))}
          </div>

          <BottomNav />
        </div>
      )}

      {step === 'serviceDetail' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '0 0 28px', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)', background: 'var(--bg)' }}>
          <div style={{ position: 'relative', height: '280px', background: 'var(--sf)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/images/car.png" alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg) 0%, transparent 60%)' }}></div>
          </div>
          <button onClick={() => setStep('services')} style={{ position: 'absolute', top: '56px', left: '16px', width: '42px', height: '42px', borderRadius: '50%', background: 'var(--bg)', boxShadow: 'var(--sh)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
            <svg width="18" height="18" viewBox="0 0 17 17" fill="none"><path d="M10.5 3.5 5.5 8.5l5 5" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
          </button>
          <div style={{ padding: '0 20px 0' }}>
            <div style={{ font: '800 28px/1.1 Manrope,sans-serif', letterSpacing: '-.045em', marginBottom: '9px' }}>TurCarro</div>
            <div style={{ font: '500 14px/1.6 Manrope,sans-serif', color: 'var(--mu)', marginBottom: '22px' }}>Viaja a cualquier punto de Buenaventura con la app. Pides, se sube y se relaja: el precio se fija antes de arrancar y no cambia por el tráfico.</div>
            <div style={{ display: 'flex', gap: '9px', marginBottom: '24px' }}>
              <div style={{ flex: 1, padding: '14px 15px', borderRadius: '13px', background: 'var(--sf)' }}>
                <div style={{ font: '500 10.5px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '4px' }}>Desde</div>
                <div style={{ font: "800 18px/1 'IBM Plex Mono',monospace" }}>$6.900</div>
              </div>
              <div style={{ flex: 1, padding: '14px 15px', borderRadius: '13px', background: 'var(--sf)' }}>
                <div style={{ font: '500 10.5px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '4px' }}>Personas</div>
                <div style={{ font: '800 18px/1 Manrope,sans-serif' }}>4</div>
              </div>
              <div style={{ flex: 1, padding: '14px 15px', borderRadius: '13px', background: 'var(--sf)' }}>
                <div style={{ font: '500 10.5px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '4px' }}>Espera</div>
                <div style={{ font: "800 18px/1 'IBM Plex Mono',monospace" }}>3 min</div>
              </div>
            </div>
            <div style={{ font: '800 19px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '14px' }}>Cómo funciona</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '26px' }}>
              {[
                { n: '1', title: 'Pon tu destino', body: 'Escríbelo o elígelo en el mapa. Te mostramos el precio exacto antes de pedir.' },
                { n: '2', title: 'Encuentra a tu conductor', body: 'Verifica la placa, dile tu PIN y sigue el carro en el mapa.' },
                { n: '3', title: 'Paga y califica', body: 'Paga con Nequi, tarjeta o efectivo. La calificación es anónima.' }
              ].map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: '14px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--inv)', color: 'var(--invtx)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 13px Manrope,sans-serif', flex: 'none' }}>{d.n}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 14.5px Manrope,sans-serif', marginBottom: '3px' }}>{d.title}</div>
                    <div style={{ font: '500 12.5px/1.5 Manrope,sans-serif', color: 'var(--mu)' }}>{d.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => router.push('/home')} style={{ height: '54px', borderRadius: '13px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 16px Manrope,sans-serif', width: '100%' }}>Pedir ahora</button>
          </div>
        </div>
      )}

      {step === 'package' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '50px 20px 28px', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0 18px' }}>
            <button onClick={() => setStep('services')} style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="19" height="19" viewBox="0 0 17 17" fill="none"><path d="M10.5 3.5 5.5 8.5l5 5" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </button>
            <div style={{ font: '800 19px Manrope,sans-serif', letterSpacing: '-.03em' }}>Enviar paquete</div>
          </div>
          <div style={{ font: '700 14px Manrope,sans-serif', marginBottom: '10px' }}>¿Qué vas a enviar?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px', marginBottom: '22px' }}>
            {[
              { name: 'Documentos', sub: 'Papeles, sobres sellados', glyph: '📄' },
              { name: 'Comida', sub: 'Sellada, sin bebidas', glyph: '🍽️' },
              { name: 'Llaves y objetos', sub: 'Menos de 1 kg', glyph: '🔑' },
              { name: 'Compra en tienda', sub: 'Pagamos y entregamos', glyph: '🛍️' }
            ].map((pk, i) => (
              <button key={i} onClick={() => setPackageType(pk.name)} style={{ borderRadius: '14px', background: 'var(--sf)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', border: packageType === pk.name ? '2px solid var(--tx)' : '2px solid transparent' }}>
                <div style={{ fontSize: '24px', flex: 'none' }}>{pk.glyph}</div>
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <div style={{ font: '700 13.5px Manrope,sans-serif' }}>{pk.name}</div>
                  <div style={{ font: '500 10.5px/1.35 Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px' }}>{pk.sub}</div>
                </div>
              </button>
            ))}
          </div>

          <div style={{ font: '700 14px Manrope,sans-serif', marginBottom: '10px' }}>¿Qué tan grande es?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '22px' }}>
            {[
              { name: 'Sobre', sub: 'Documentos, llaves', box: '18px' },
              { name: 'Caja pequeña', sub: 'Hasta 5 kg', box: '28px' },
              { name: 'Caja grande', sub: 'Hasta 20 kg', box: '40px' }
            ].map((p, i) => (
              <button key={i} onClick={() => setPackageSize(p.name)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', background: 'var(--sf)', border: packageSize === p.name ? '2px solid var(--tx)' : '2px solid transparent' }}>
                <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: p.box, height: p.box, borderRadius: '4px', background: 'var(--tx)', opacity: .85, flex: 'none' }}></div>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}><div style={{ font: '700 14.5px Manrope,sans-serif' }}>{p.name}</div><div style={{ font: '500 11.5px Manrope,sans-serif', color: 'var(--mu)' }}>{p.sub}</div></div>
                <div style={{ font: "700 14px 'IBM Plex Mono',monospace" }}>${PACKAGE_SIZE_MAP[p.name].price.toLocaleString('es-CO')}</div>
              </button>
            ))}
          </div>

          <div style={{ font: '700 14px Manrope,sans-serif', marginBottom: '10px' }}>¿Dónde lo recogemos?</div>
          <div style={{ borderRadius: '13px', background: 'var(--sf)', overflow: 'hidden', marginBottom: '18px', padding: '13px 16px' }}>
            <div style={{ font: '500 11px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '2px' }}>Dirección de recogida</div>
            <input value={senderAddress} onChange={(e) => setSenderAddress(e.target.value)} placeholder="Ej: Calle 5 #3-20, Centro" style={{ width: '100%', background: 'none', border: 'none', outline: 'none', font: '600 14.5px Manrope,sans-serif', color: 'var(--tx)' }} />
          </div>

          <div style={{ font: '700 14px Manrope,sans-serif', marginBottom: '10px' }}>¿Quién recibe?</div>
          <div style={{ borderRadius: '13px', background: 'var(--sf)', overflow: 'hidden', marginBottom: '13px' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--bd2)' }}>
              <div style={{ font: '500 11px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '2px' }}>Nombre</div>
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nombre de quien recibe" style={{ width: '100%', background: 'none', border: 'none', outline: 'none', font: '600 14.5px Manrope,sans-serif', color: 'var(--tx)' }} />
            </div>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--bd2)' }}>
              <div style={{ font: '500 11px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '2px' }}>Celular</div>
              <input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="300 000 0000" style={{ width: '100%', background: 'none', border: 'none', outline: 'none', font: "600 14.5px 'IBM Plex Mono',monospace", color: 'var(--tx)' }} />
            </div>
            <div style={{ padding: '13px 16px' }}>
              <div style={{ font: '500 11px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '2px' }}>Dirección de entrega</div>
              <input value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="Dirección de entrega" style={{ width: '100%', background: 'none', border: 'none', outline: 'none', font: '600 14.5px Manrope,sans-serif', color: 'var(--tx)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '13px 15px', borderRadius: '12px', background: 'var(--sf)', marginBottom: '20px' }}>
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" style={{ flex: 'none', marginTop: '1px' }}><circle cx="8" cy="8" r="6.4" stroke="var(--mu)" strokeWidth="1.5"></circle><path d="M8 4.8v4.4" stroke="var(--mu)" strokeWidth="1.5" strokeLinecap="round"></path><circle cx="8" cy="11.4" r=".9" fill="var(--mu)"></circle></svg>
            <div style={{ font: '500 11.5px/1.45 Manrope,sans-serif', color: 'var(--mu)' }}>El conductor puede rechazar el paquete si el contenido no coincide o excede el tamaño.</div>
          </div>
          {packageError && <div style={{ color: '#d32f2f', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{packageError}</div>}
          <button onClick={handleRequestPackage} disabled={packageLoading} style={{ height: '54px', borderRadius: '13px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 16px Manrope,sans-serif', width: '100%', opacity: packageLoading ? 0.6 : 1 }}>
            {packageLoading ? 'Enviando...' : `Buscar repartidor · $${PACKAGE_SIZE_MAP[packageSize].price.toLocaleString('es-CO')}`}
          </button>
        </div>
      )}

      {step === 'schedule' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', animation: 'trFade .25s ease' }}>
          <div className="tr-sb" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '85dvh', overflowY: 'auto', background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '24px 20px 28px', animation: 'trUpS .34s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <div style={{ font: '800 22px/1.2 Manrope,sans-serif', letterSpacing: '-.035em' }}>Reserva tu viaje</div>
                <button onClick={() => setStep('services')} style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="var(--tx)" strokeWidth="2" strokeLinecap="round"></path></svg>
                </button>
            </div>
            <div style={{ font: '500 13px/1.5 Manrope,sans-serif', color: 'var(--mu)', marginBottom: '18px' }}>Programa hasta 30 días antes. Confirmamos conductor 30 minutos antes.</div>
            
            <div className="tr-sb" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '14px', paddingBottom: '2px' }}>
              {scheduleDays.map((d, i) => (
                <button key={i} onClick={() => setScheduledDayIndex(i)} style={{ width: '56px', height: '64px', borderRadius: '13px', background: 'var(--sf)', border: scheduledDayIndex === i ? '2px solid var(--tx)' : '2px solid transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                  <div style={{ font: '600 10px Manrope,sans-serif', color: 'var(--mu)', letterSpacing: '.08em' }}>{d.dow}</div>
                  <div style={{ font: '800 19px/1 Manrope,sans-serif', marginTop: '4px' }}>{d.num}</div>
                </button>
              ))}
            </div>
            
            {/* Hora */}
            <div style={{ font: '700 10.5px Manrope,sans-serif', color: 'var(--mu)', letterSpacing: '.1em', marginBottom: '8px' }}>¿A QUÉ HORA?</div>
            <div className="tr-sb" style={{ display: 'flex', gap: '7px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '2px' }}>
              {HORAS_RESERVA.map((h) => (
                <button key={h} onClick={() => setScheduleHora(h)}
                  style={{ flex: 'none', height: '40px', padding: '0 15px', borderRadius: '11px',
                    background: scheduleHora === h ? 'var(--inv)' : 'var(--sf)',
                    color: scheduleHora === h ? 'var(--invtx)' : 'var(--tx)',
                    font: '700 12.5px Manrope,sans-serif', border: 'none' }}>
                  {h}
                </button>
              ))}
            </div>

            {/* De dónde y para dónde */}
            <div style={{ borderRadius: '13px', background: 'var(--sf)', overflow: 'hidden', marginBottom: '10px' }}>
              {[['origen', 'Te recogemos en', origen], ['destino', 'Vas hasta', destino]].map(([id, label, valor]) => (
                <button key={id} onClick={() => { setCampo(id); setBusqueda(''); setResultados([]); }}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'transparent', border: 'none', borderBottom: id === 'origen' ? '1px solid var(--bd2)' : 'none' }}>
                  <span style={{ width: '10px', height: '10px', flex: 'none', borderRadius: id === 'origen' ? '50%' : '2px', border: id === 'origen' ? '2.5px solid var(--jade)' : 'none', background: id === 'destino' ? 'var(--tx)' : 'transparent' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', font: '600 10.5px Manrope,sans-serif', color: 'var(--mu)' }}>{label}</span>
                    <span style={{ display: 'block', font: '700 13.5px Manrope,sans-serif', color: valor ? 'var(--tx)' : 'var(--mu)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {valor ? valor.nombre : 'Escribe la dirección'}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {campo && (
              <div style={{ marginBottom: '14px' }}>
                <input autoFocus value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={campo === 'origen' ? '¿Dónde te recogemos?' : '¿A dónde vas?'}
                  style={{ width: '100%', height: '46px', borderRadius: '12px', border: '1px solid var(--bd2)', background: 'var(--bg)', padding: '0 14px', font: '600 13.5px Manrope,sans-serif', color: 'var(--tx)' }} />
                {buscando && <div style={{ font: '500 11.5px Manrope,sans-serif', color: 'var(--mu)', padding: '8px 4px' }}>Buscando…</div>}
                {resultados.slice(0, 4).map((r, i) => (
                  <button key={i} onClick={() => {
                      const punto = { nombre: r.display_name.split(',').slice(0, 2).join(',').trim(), lat: Number(r.lat), lon: Number(r.lon) };
                      campo === 'origen' ? setOrigen(punto) : setDestino(punto);
                      setCampo(null); setBusqueda(''); setResultados([]);
                    }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 13px', marginTop: '6px', borderRadius: '11px', background: 'var(--sf)', border: 'none', font: '600 12.5px/1.35 Manrope,sans-serif', color: 'var(--tx)' }}>
                    {r.display_name.split(',').slice(0, 3).join(', ')}
                  </button>
                ))}
              </div>
            )}

            {/* Precio: tarifa legal con los recargos que apliquen a esa hora */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px 16px', borderRadius: '13px', background: 'var(--sf)', marginBottom: '14px' }}>
              <span style={{ fontSize: '19px' }}>🚕</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '700 14px Manrope,sans-serif' }}>Taxi</div>
                <div style={{ font: '500 11px Manrope,sans-serif', color: 'var(--mu)' }}>
                  {origen && destino ? `${kmReserva.toFixed(1)} km aprox.` : 'Escoge origen y destino para el precio'}
                </div>
              </div>
              <div style={{ font: "700 15px 'IBM Plex Mono',monospace" }}>
                {origen && destino ? `$${precioReserva.toLocaleString('es-CO')}` : `desde $${precioReserva.toLocaleString('es-CO')}`}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '12px 14px', borderRadius: '12px', background: 'var(--jadeS)', marginBottom: '16px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flex: 'none' }}><path d="M4 8.4 6.8 11 12 5" stroke="var(--jade)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              <div style={{ font: '600 11.5px/1.4 Manrope,sans-serif', color: 'var(--jade)' }}>
                Tarifa del Decreto 0048, con recargo de noche o de domingo si aplica. El conductor no te cobra de más.
              </div>
            </div>
            {scheduleError && <div style={{ color: '#d32f2f', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{scheduleError}</div>}
            <button onClick={handleConfirmSchedule} disabled={scheduleLoading} style={{ height: '54px', borderRadius: '13px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 16px Manrope,sans-serif', width: '100%', opacity: scheduleLoading ? 0.6 : 1 }}>
              {scheduleLoading ? 'Confirmando...' : 'Confirmar reserva'}
            </button>
          </div>
        </div>
      )}

      {step === 'favor' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '0 0 28px', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)', background: 'var(--bg)' }}>
          <div style={{ position: 'relative', background: 'var(--jade)', padding: '58px 20px 22px', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: '-38px', top: '-46px', width: '190px', height: '190px', borderRadius: '50%', border: '15px solid rgba(255,255,255,.12)' }}></div>
            <button onClick={() => setStep('services')} style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', position: 'relative' }}>
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none"><path d="M10.5 3.5 5.5 8.5l5 5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            </button>
            <div style={{ font: '800 26px/1.1 Manrope,sans-serif', letterSpacing: '-.045em', color: '#fff', marginBottom: '8px', position: 'relative' }}>Tura favor</div>
            <div style={{ font: '500 13px/1.55 Manrope,sans-serif', color: 'rgba(255,255,255,.85)', maxWidth: '250px', position: 'relative' }}>Alguien hace el mandado por ti: lo compra, hace la fila o lo recoge.</div>
          </div>
          
          <div style={{ padding: '20px 16px 0' }}>
            <div style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '12px' }}>¿Qué necesitas?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px', marginBottom: '22px' }}>
              {[
                { name: 'Comprar', sub: 'Farmacia, súper', glyph: '🛒' },
                { name: 'Recoger', sub: 'Llaves, ropa', glyph: '🛍️' },
                { name: 'Hacer fila', sub: 'Bancos, trámites', glyph: '⏳' },
                { name: 'Otro', sub: 'Escríbelo abajo', glyph: '💬' }
              ].map((fk, i) => (
                <button key={i} onClick={() => setFavorType(fk.name)} style={{ borderRadius: '14px', background: 'var(--sf)', padding: '14px', display: 'flex', gap: '10px', alignItems: 'center', border: favorType === fk.name ? '2px solid var(--tx)' : '2px solid transparent' }}>
                  <div style={{ fontSize: '24px', flex: 'none' }}>{fk.glyph}</div>
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div style={{ font: '700 13.5px Manrope,sans-serif' }}>{fk.name}</div>
                    <div style={{ font: '500 10.5px/1.35 Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px' }}>{fk.sub}</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '11px' }}>Detalles del mandado</div>
            <div style={{ borderRadius: '14px', background: 'var(--sf)', padding: '15px 16px', marginBottom: '12px', minHeight: '92px' }}>
              <textarea 
                value={favorDescription}
                onChange={(e) => setFavorDescription(e.target.value)}
                placeholder="Ej: Compra 2 bolsas de leche deslactosada Colanta y 1 paquete de pan tajado Bimbo blanco. Paga con el dinero del presupuesto, yo te transfiero al entregar."
                style={{ width: '100%', height: '62px', background: 'transparent', border: 'none', resize: 'none', font: '500 13px/1.6 Manrope,sans-serif', color: 'var(--tx)', outline: 'none' }}
              />
            </div>
            
            <div style={{ borderRadius: '14px', background: 'var(--sf)', overflow: 'hidden', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--bd2)' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', border: '2.5px solid var(--jade)', flex: 'none' }}></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: '500 10.5px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '2px' }}>Dónde es</div><div style={{ font: '600 14px Manrope,sans-serif' }}>Éxito Buenaventura · Calle 7</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: 'var(--tx)', flex: 'none' }}></div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ font: '500 10.5px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '2px' }}>Dónde entregarlo</div><div style={{ font: '600 14px Manrope,sans-serif' }}>Calle 6 #3-24, Comuna 4</div></div>
              </div>
            </div>
            
            <div style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '11px' }}>Presupuesto para la compra</div>
            <div style={{ display: 'flex', gap: '9px', marginBottom: '12px' }}>
              {[
                { label: 'Nada (fila/recoger)', value: 0 },
                { label: '$20.000', value: 20000 },
                { label: '$50.000', value: 50000 }
              ].map((fb, i) => (
                <button key={i} onClick={() => setFavorBudget(fb.value)} style={{ flex: 1, height: '44px', borderRadius: '10px', background: 'var(--sf)', font: "700 13px 'IBM Plex Mono',monospace", border: favorBudget === fb.value ? '2px solid var(--tx)' : '2px solid transparent' }}>{fb.label}</button>
              ))}
            </div>
            
            <div style={{ borderRadius: '14px', background: 'var(--sf)', padding: '15px 16px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', padding: '4px 0', font: '500 13px Manrope,sans-serif', color: 'var(--mu)', whiteSpace: 'nowrap' }}><div>Costo del servicio</div><div style={{ fontFamily: "'IBM Plex Mono',monospace" }}>${favorServiceFee.toLocaleString('es-CO')}</div></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', padding: '4px 0', font: '500 13px Manrope,sans-serif', color: 'var(--mu)', whiteSpace: 'nowrap' }}><div>Presupuesto</div><div style={{ fontFamily: "'IBM Plex Mono',monospace" }}>${favorBudget.toLocaleString('es-CO')}</div></div>
              <div style={{ height: '1px', background: 'var(--bd)', margin: '9px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', font: '800 15.5px Manrope,sans-serif' }}><div>Total</div><div style={{ fontFamily: "'IBM Plex Mono',monospace" }}>${(favorBudget + favorServiceFee).toLocaleString('es-CO')}</div></div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '13px 15px', borderRadius: '12px', background: 'var(--jadeS)', marginBottom: '18px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flex: 'none', marginTop: '1px' }}><path d="M4 8.4 6.8 11 12 5" stroke="var(--jade)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              <div style={{ font: '600 11px/1.5 Manrope,sans-serif', color: 'var(--jade)' }}>Asegúrate de tener saldo en Turapp Cash o Nequi para transferir el costo del producto apenas el conductor te envíe la factura.</div>
            </div>
            
            {favorError && <div style={{ color: '#d32f2f', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{favorError}</div>}
            <button onClick={handleRequestFavor} disabled={favorLoading} style={{ height: '54px', borderRadius: '13px', background: favorLoading ? '#666' : 'var(--inv)', color: 'var(--invtx)', font: '700 16px Manrope,sans-serif', width: '100%', transition: 'background 0.2s' }}>{favorLoading ? 'Procesando...' : 'Pedir Turafavor'}</button>
          </div>
        </div>
      )}

      {/* Bottom Nav Placeholder */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '390px', height: '80px', background: 'var(--bg)', borderTop: '1px solid var(--bd2)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 100 }}>
        <button onClick={() => router.push('/home')} style={{ color: 'var(--mu)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 7v11a1 1 0 01-1 1H4a1 1 0 01-1-1V10l9-7zm0 2.5L5.5 10v9.5h13V10L12 5.5z"/></svg>
          <span style={{ font: '600 10px Manrope,sans-serif' }}>Inicio</span>
        </button>
        <button style={{ color: 'var(--tx)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
          <span style={{ font: '600 10px Manrope,sans-serif' }}>Servicios</span>
        </button>
        <button onClick={() => router.push('/activity')} style={{ color: 'var(--mu)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
          <span style={{ font: '600 10px Manrope,sans-serif' }}>Actividad</span>
        </button>
        <button onClick={() => router.push('/account')} style={{ color: 'var(--mu)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
          <span style={{ font: '600 10px Manrope,sans-serif' }}>Cuenta</span>
        </button>
      </div>
    </>
  );
}

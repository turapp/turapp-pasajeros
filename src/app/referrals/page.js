'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import BottomNav from '../../components/BottomNav';

// ============================================================
// REFERIDOS — PASAJERO
// ============================================================
// El pasajero invita pasajeros. Cuando su invitado hace el primer viaje, él
// gana viajes gratis (cupones) y además una comisión recurrente sobre lo que
// Turapp gane de esa persona, de por vida.
//
// La estructura visual sigue la de MagicAI: tarjeta oscura arriba con la
// ganancia y el link, "cómo funciona" numerado, formulario de retiro y tabla
// de solicitudes.

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');

const ESTADO = {
  pendiente: ['Pendiente', '#c98a1e', 'rgba(201,138,30,.12)'],
  aprobado: ['Aprobado', '#0f8a6d', 'rgba(15,138,109,.12)'],
  pagado: ['Pagado', '#0f8a6d', 'rgba(15,138,109,.12)'],
  rechazado: ['Rechazado', '#c8402f', 'rgba(200,64,47,.12)'],
};

export default function ReferralsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [afiliado, setAfiliado] = useState(null);
  const [cupones, setCupones] = useState([]);
  const [referidos, setReferidos] = useState(0);
  const [retiros, setRetiros] = useState([]);
  const [reglas, setReglas] = useState({});
  const [copiado, setCopiado] = useState(false);
  const [monto, setMonto] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [metodo, setMetodo] = useState('nequi');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (uid) => {
    // Si todavía no es afiliado, se le crea su código al entrar aquí: no hay
    // razón para pedirle que "se inscriba" a algo que es gratis.
    let { data: af } = await supabase.from('affiliates').select('*').eq('user_id', uid).maybeSingle();
    if (!af) {
      const { data: nuevo } = await supabase.from('affiliates').insert({ user_id: uid }).select().single();
      af = nuevo;
    }
    if (!af) { setCargando(false); return; }

    const [{ data: cups }, { count }, { data: ws }, { data: cfg }] = await Promise.all([
      supabase.from('user_coupons').select('*').eq('user_id', uid).eq('estado', 'disponible').order('vence_at'),
      supabase.from('affiliate_referrals').select('id', { count: 'exact', head: true }).eq('affiliate_id', af.id),
      supabase.from('affiliate_withdrawals').select('*').eq('affiliate_id', af.id).order('created_at', { ascending: false }),
      supabase.from('app_settings').select('key, value').eq('grupo', 'afiliados'),
    ]);

    setAfiliado(af);
    setCupones(cups || []);
    setReferidos(count ?? 0);
    setRetiros(ws || []);
    setReglas(Object.fromEntries((cfg || []).map(r => [r.key, r.value])));
    setCargando(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) { router.push('/'); return; }
      setUser(data.user);
      cargar(data.user.id);
    });
  }, [cargar, router]);

  const link = afiliado ? `https://turapp.co/?ref=${afiliado.codigo}` : '';
  const disponible = afiliado ? Number(afiliado.total_generado || 0) - Number(afiliado.total_retirado || 0) : 0;
  const minimo = Number(reglas.afiliados_retiro_min ?? 10000);
  const premio = Number(reglas.afiliados_premio_cant ?? 3);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* algunos navegadores lo bloquean sin gesto directo */ }
  };

  const compartir = async () => {
    const texto = `Pídete un taxi en Turapp con mi código ${afiliado?.codigo} y estrena la app en Buenaventura.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Turapp', text: texto, url: link }); return; } catch { /* canceló */ }
    }
    copiar();
  };

  const pedirRetiro = async (e) => {
    e.preventDefault();
    const m = Number(monto);
    if (!m || m < minimo) { alert(`El retiro mínimo es ${money(minimo)}.`); return; }
    if (m > disponible) { alert('No puedes retirar más de tu saldo disponible.'); return; }
    if (!cuenta.trim()) { alert('Escribe el número de la cuenta donde quieres recibir.'); return; }

    setEnviando(true);
    const { error } = await supabase.from('affiliate_withdrawals').insert({
      affiliate_id: afiliado.id, monto: m, metodo, cuenta: cuenta.trim(),
    });
    setEnviando(false);
    if (error) { alert('No se pudo enviar: ' + error.message); return; }
    setMonto(''); setCuenta('');
    cargar(user.id);
  };

  return (
    <>
      <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--bg)', padding: '46px 0 100px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px 18px' }}>
          <button onClick={() => router.back()} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div style={{ font: '800 21px Manrope,sans-serif', letterSpacing: '-.03em', color: 'var(--tx)' }}>Invita y gana</div>
        </div>

        {/* Tarjeta principal */}
        <div style={{ margin: '0 16px', padding: '22px', borderRadius: '22px', background: 'linear-gradient(155deg,#1a1330 0%,#2d1b52 55%,#3d2168 100%)', color: '#fff' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 190px', minWidth: 0 }}>
              <div style={{ font: '800 19px/1.35 Manrope,sans-serif', letterSpacing: '-.02em' }}>
                Invita a tus amigos y gana {premio} viajes gratis 🎁
              </div>
              <div style={{ font: '500 12.5px/1.55 Manrope,sans-serif', opacity: .75, marginTop: '8px' }}>
                Cuando tu invitado haga su primer viaje, recibes tus viajes gratis
                y empiezas a ganar comisión de por vida por cada viaje que él haga.
              </div>
            </div>
            <div style={{ textAlign: 'right', flex: 'none' }}>
              <div style={{ font: '600 10px Manrope,sans-serif', opacity: .65, letterSpacing: '.1em' }}>GANANCIAS</div>
              <div style={{ font: '800 34px Manrope,sans-serif', letterSpacing: '-.04em', lineHeight: 1.1 }}>
                {cargando ? '—' : money(afiliado?.total_generado)}
              </div>
              <div style={{ font: '500 11px Manrope,sans-serif', opacity: .7, marginTop: '4px' }}>
                Comisión: {reglas.afiliados_comision ?? 10}%
              </div>
            </div>
          </div>

          <div style={{ font: '600 10px Manrope,sans-serif', opacity: .65, letterSpacing: '.1em', margin: '20px 0 7px' }}>TU LINK</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,.1)', borderRadius: '11px', padding: '12px 14px', font: "500 12px 'IBM Plex Mono',monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cargando ? 'Generando…' : link}
            </div>
            <button onClick={copiar} disabled={!link}
              style={{ width: '44px', height: '44px', borderRadius: '11px', background: 'rgba(255,255,255,.14)', border: 'none', color: '#fff', flex: 'none', fontSize: '15px' }}>
              {copiado ? '✓' : '⧉'}
            </button>
          </div>

          <button onClick={compartir} disabled={!link}
            style={{ width: '100%', height: '48px', borderRadius: '13px', background: '#fff', color: '#2d1b52', font: '800 14px Manrope,sans-serif', border: 'none', marginTop: '12px' }}>
            Compartir mi link
          </button>
        </div>

        {/* Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '9px', margin: '14px 16px 0' }}>
          <Metrica label="Invitados" valor={cargando ? '—' : referidos} />
          <Metrica label="Viajes gratis" valor={cargando ? '—' : cupones.length} destacado={cupones.length > 0} />
          <Metrica label="Disponible" valor={cargando ? '—' : money(disponible)} />
        </div>

        {/* Cupones ganados */}
        {cupones.length > 0 && (
          <div style={{ margin: '18px 16px 0' }}>
            <div style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.025em', color: 'var(--tx)', marginBottom: '10px' }}>
              Tus viajes gratis
            </div>
            {cupones.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px', borderRadius: '14px', background: 'var(--jadeS)', marginBottom: '8px' }}>
                <div style={{ fontSize: '20px', flex: 'none' }}>🎟️</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 13.5px Manrope,sans-serif', color: 'var(--jade)' }}>
                    {c.tipo === 'free_trip' ? 'Viaje gratis' : `${c.valor}% de descuento`}
                    {c.tope ? ` · hasta ${money(c.tope)}` : ''}
                  </div>
                  <div style={{ font: "500 11px 'IBM Plex Mono',monospace", color: 'var(--mu)', marginTop: '2px' }}>
                    {c.codigo}{c.vence_at ? ` · vence ${new Date(c.vence_at).toLocaleDateString('es-CO')}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cómo funciona */}
        <div style={{ margin: '20px 16px 0' }}>
          <div style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.025em', color: 'var(--tx)', marginBottom: '12px' }}>
            Cómo funciona
          </div>
          {[
            ['Comparte tu link', 'Mándaselo a quien quieras por WhatsApp o redes.'],
            ['Tu amigo pide su primer viaje', 'Se registra con tu link y viaja normal.'],
            [`Ganas ${premio} viajes gratis`, 'Y desde ahí, comisión por cada viaje que él haga, de por vida.'],
          ].map(([t, s], i) => (
            <div key={i} style={{ display: 'flex', gap: '13px', marginBottom: '14px' }}>
              <div style={{ width: '25px', height: '25px', borderRadius: '50%', background: 'var(--jadeS)', color: 'var(--jade)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 12px Manrope,sans-serif', flex: 'none' }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '700 13.5px Manrope,sans-serif', color: 'var(--tx)' }}>{t}</div>
                <div style={{ font: '500 12px/1.5 Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px' }}>{s}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Retiro */}
        <div style={{ margin: '10px 16px 0', padding: '18px', borderRadius: '18px', background: 'var(--sf)' }}>
          <div style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.025em', color: 'var(--tx)' }}>Retirar mi comisión</div>
          <div style={{ font: '500 12px/1.5 Manrope,sans-serif', color: 'var(--mu)', margin: '4px 0 14px' }}>
            Disponible: <strong style={{ color: 'var(--tx)' }}>{money(disponible)}</strong> · mínimo {money(minimo)}
          </div>

          <form onSubmit={pedirRetiro}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              {['nequi', 'daviplata', 'bancolombia'].map((m) => (
                <button key={m} type="button" onClick={() => setMetodo(m)}
                  style={{ flex: 1, height: '38px', borderRadius: '11px', border: metodo === m ? '2px solid var(--tx)' : '1px solid var(--bd2)', background: 'var(--bg)', font: '700 11.5px Manrope,sans-serif', color: 'var(--tx)', textTransform: 'capitalize' }}>
                  {m}
                </button>
              ))}
            </div>
            <input value={cuenta} onChange={(e) => setCuenta(e.target.value)} placeholder="Número de cuenta o celular"
              style={{ width: '100%', height: '46px', borderRadius: '12px', border: '1px solid var(--bd2)', background: 'var(--bg)', padding: '0 14px', font: '600 13.5px Manrope,sans-serif', color: 'var(--tx)', marginBottom: '9px' }} />
            <input value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric"
              placeholder={`Monto (mínimo ${money(minimo)})`}
              style={{ width: '100%', height: '46px', borderRadius: '12px', border: '1px solid var(--bd2)', background: 'var(--bg)', padding: '0 14px', font: "600 13.5px 'IBM Plex Mono',monospace", color: 'var(--tx)', marginBottom: '12px' }} />
            <button type="submit" disabled={enviando || disponible < minimo}
              style={{ width: '100%', height: '48px', borderRadius: '13px', background: disponible >= minimo ? 'var(--tx)' : 'var(--sf2)', color: disponible >= minimo ? 'var(--bg)' : 'var(--mu)', font: '800 14px Manrope,sans-serif', border: 'none' }}>
              {enviando ? 'Enviando…' : disponible < minimo ? `Necesitas ${money(minimo)} para retirar` : 'Solicitar retiro'}
            </button>
          </form>
        </div>

        {/* Solicitudes */}
        {retiros.length > 0 && (
          <div style={{ margin: '18px 16px 0' }}>
            <div style={{ font: '800 17px Manrope,sans-serif', letterSpacing: '-.025em', color: 'var(--tx)', marginBottom: '10px' }}>
              Mis solicitudes
            </div>
            {retiros.map((r) => {
              const [label, color, bg] = ESTADO[r.estado] || [r.estado, 'var(--mu)', 'var(--sf)'];
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px', borderRadius: '13px', border: '1px solid var(--bd2)', marginBottom: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: "700 14px 'IBM Plex Mono',monospace", color: 'var(--tx)' }}>{money(r.monto)}</div>
                    <div style={{ font: '500 11px Manrope,sans-serif', color: 'var(--mu)', marginTop: '2px', textTransform: 'capitalize' }}>
                      {r.metodo} · {new Date(r.created_at).toLocaleDateString('es-CO')}
                    </div>
                  </div>
                  <div style={{ padding: '4px 10px', borderRadius: '99px', background: bg, color, font: '700 11px Manrope,sans-serif', flex: 'none' }}>{label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}

function Metrica({ label, valor, destacado }) {
  return (
    <div style={{ background: destacado ? 'var(--jadeS)' : 'var(--sf)', borderRadius: '15px', padding: '14px 12px', textAlign: 'center' }}>
      <div style={{ font: '800 19px Manrope,sans-serif', letterSpacing: '-.03em', color: destacado ? 'var(--jade)' : 'var(--tx)' }}>{valor}</div>
      <div style={{ font: '600 10.5px Manrope,sans-serif', color: 'var(--mu)', marginTop: '3px' }}>{label}</div>
    </div>
  );
}

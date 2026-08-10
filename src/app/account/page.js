'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import BottomNav from '../../components/BottomNav';
import { useAppContext } from '../../context/AppProvider';

export default function AccountPage() {
  const router = useRouter();
  const { theme, toggleTheme, lang, changeLang } = useAppContext();
  const [step, setStep] = useState('account'); // account, support, settings, payments
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [addMethodType, setAddMethodType] = useState(null); // null | 'nequi' | 'daviplata' | 'card'
  const [newMethodPhone, setNewMethodPhone] = useState('');
  const [savingMethod, setSavingMethod] = useState(false);
  const [methodError, setMethodError] = useState(null);

  const PAYMENT_TYPE_LABEL = { nequi: 'Nequi', daviplata: 'Daviplata', card: 'Tarjeta' };

  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSending, setTicketSending] = useState(false);
  const [ticketError, setTicketError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const loadTickets = async () => {
    setTicketsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTicketsLoading(false); return; }
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTickets(data || []);
    setTicketsLoading(false);
  };

  const openSupport = () => {
    setStep('support');
    loadTickets();
  };

  const loadPaymentMethods = async () => {
    setPaymentMethodsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPaymentMethodsLoading(false); return; }
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setPaymentMethods(data || []);
    setPaymentMethodsLoading(false);
  };

  const openPayments = () => {
    setStep('payments');
    setAddMethodType(null);
    setMethodError(null);
    loadPaymentMethods();
  };

  const handleAddMethod = async () => {
    if (addMethodType !== 'nequi' && addMethodType !== 'daviplata') return;
    if (!newMethodPhone.trim()) return;
    setSavingMethod(true);
    setMethodError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Debes iniciar sesión.');
      const { error } = await supabase.from('payment_methods').insert({
        user_id: user.id,
        type: addMethodType,
        label: PAYMENT_TYPE_LABEL[addMethodType],
        phone_number: newMethodPhone.trim(),
        is_default: paymentMethods.length === 0,
      });
      if (error) throw error;
      setNewMethodPhone('');
      setAddMethodType(null);
      await loadPaymentMethods();
    } catch (err) {
      setMethodError(err.message || 'No se pudo guardar el método de pago.');
    } finally {
      setSavingMethod(false);
    }
  };

  const handleSetDefaultMethod = async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('payment_methods').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('payment_methods').update({ is_default: true }).eq('id', id);
    loadPaymentMethods();
  };

  const handleDeleteMethod = async (id) => {
    await supabase.from('payment_methods').delete().eq('id', id);
    loadPaymentMethods();
  };

  const handleCreateTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;
    setTicketSending(true);
    setTicketError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Debes iniciar sesión.');
      const { error } = await supabase.from('tickets').insert({
        user_id: user.id,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
      });
      if (error) throw error;
      setTicketSubject('');
      setTicketMessage('');
      await loadTickets();
    } catch (err) {
      setTicketError(err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setTicketSending(false);
    }
  };

  const TICKET_STATUS_LABEL = { open: 'Abierto', in_progress: 'En progreso', resolved: 'Resuelto', closed: 'Cerrado' };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <>
      {step === 'account' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '40px 24px 100px', background: 'var(--bg)', color: 'var(--tx)', animation: 'trFade .3s ease' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <div style={{ font: '800 32px/1.1 Manrope,sans-serif', letterSpacing: '-0.04em', color: 'var(--tx)', marginBottom: '4px', whiteSpace: 'pre-line' }}>
                {loading ? 'Cargando...' : profile?.first_name ? `${profile.first_name}\n${profile.last_name || ''}` : 'Pasajero'}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--sf)', padding: '6px 10px', borderRadius: '8px', boxShadow: 'var(--sh2)' }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--tx)"><path d="M8 12.8l-4.4 2.3.8-4.9L.8 6.7l4.9-.7L8 1.5l2.3 4.5 4.9.7-3.6 3.5.8 4.9L8 12.8z"></path></svg>
                <div style={{ font: '700 13px Manrope,sans-serif', color: 'var(--tx)' }}>{profile?.rating || '5.0'}</div>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ccc' }}></div>
                <div style={{ font: '600 13px Manrope,sans-serif', color: 'var(--mu)' }}>Nuevo</div>
              </div>
            </div>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh2)', overflow: 'hidden' }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ font: '800 28px Manrope,sans-serif', color: 'var(--tx)', textTransform: 'uppercase' }}>
                  {profile?.first_name ? profile.first_name.charAt(0) : 'P'}
                </div>
              )}
            </div>
          </div>
          
          {/* Payment Methods (Wallet Style) */}
          <div style={{ font: '800 18px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '16px', color: 'var(--tx)' }}>Pago</div>
          <button onClick={openPayments} style={{ width: '100%', background: 'var(--sf)', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', boxShadow: 'var(--sh2)', cursor: 'pointer', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '44px', height: '30px', background: 'var(--sf2)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 12px Manrope,sans-serif' }}>💵</div>
              <div style={{ font: '700 15px Manrope,sans-serif', color: 'var(--tx)' }}>Métodos de pago</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--mu)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          {/* Options List */}
          <div style={{ font: '800 18px Manrope,sans-serif', letterSpacing: '-.03em', marginBottom: '16px', color: 'var(--tx)' }}>Cuenta</div>
          <div style={{ background: 'var(--sf)', borderRadius: '20px', padding: '8px', boxShadow: 'var(--sh2)', marginBottom: '32px' }}>
            <button onClick={() => router.push('/activity')} style={{ width: '100%', padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div style={{ font: '700 16px Manrope,sans-serif', color: '#111' }}>Mis Viajes</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div style={{ height: '1px', background: '#f0f0f0', margin: '0 12px' }}></div>

            <button onClick={openSupport} style={{ width: '100%', padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div style={{ font: '700 16px Manrope,sans-serif', color: '#111' }}>Soporte</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div style={{ height: '1px', background: '#f0f0f0', margin: '0 12px' }}></div>

            <button onClick={() => setStep('settings')} style={{ width: '100%', padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                </div>
                <div style={{ font: '700 16px Manrope,sans-serif', color: '#111' }}>Ajustes</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          <button onClick={handleLogout} style={{ width: '100%', height: '56px', borderRadius: '16px', background: 'var(--redS)', color: 'var(--red)', font: '800 16px Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
          
          <BottomNav />
        </div>
      )}

      {step === 'support' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '40px 24px 100px', background: 'var(--bg)', color: 'var(--tx)', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <button onClick={() => setStep('account')} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div style={{ font: '800 22px Manrope,sans-serif', letterSpacing: '-.03em' }}>Soporte</div>
          </div>

          <div style={{ background: 'var(--sf)', borderRadius: '18px', padding: '18px', marginBottom: '28px' }}>
            <div style={{ font: '700 15px Manrope,sans-serif', marginBottom: '10px' }}>Escríbenos</div>
            <input
              type="text"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Asunto (ej: Cobro incorrecto)"
              style={{ width: '100%', height: '48px', borderRadius: '12px', border: 'none', background: 'var(--bg)', padding: '0 14px', font: '600 14px Manrope,sans-serif', color: 'var(--tx)', outline: 'none', marginBottom: '10px' }}
            />
            <textarea
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
              placeholder="Cuéntanos qué pasó..."
              style={{ width: '100%', height: '90px', borderRadius: '12px', border: 'none', background: 'var(--bg)', padding: '12px 14px', font: '500 14px/1.5 Manrope,sans-serif', color: 'var(--tx)', outline: 'none', resize: 'none', marginBottom: '12px' }}
            />
            {ticketError && <div style={{ color: '#d32f2f', fontSize: '13px', marginBottom: '10px' }}>{ticketError}</div>}
            <button onClick={handleCreateTicket} disabled={ticketSending || !ticketSubject.trim() || !ticketMessage.trim()} style={{ width: '100%', height: '48px', borderRadius: '12px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 14px Manrope,sans-serif', border: 'none', opacity: ticketSending ? 0.6 : 1 }}>
              {ticketSending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>

          <div style={{ font: '800 16px Manrope,sans-serif', marginBottom: '14px' }}>Tus mensajes</div>
          {ticketsLoading ? (
            <div style={{ color: 'var(--mu)', font: '600 13px Manrope,sans-serif' }}>Cargando...</div>
          ) : tickets.length === 0 ? (
            <div style={{ color: 'var(--mu)', font: '600 13px Manrope,sans-serif' }}>Aún no has escrito a soporte.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tickets.map((t) => (
                <div key={t.id} style={{ border: '1px solid var(--bd)', borderRadius: '14px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ font: '700 14px Manrope,sans-serif' }}>{t.subject}</div>
                    <div style={{ font: '700 10px Manrope,sans-serif', color: 'var(--jade)', background: 'var(--jadeS)', padding: '3px 8px', borderRadius: '6px', flex: 'none', marginLeft: '8px' }}>{TICKET_STATUS_LABEL[t.status] || t.status}</div>
                  </div>
                  <div style={{ font: '500 12.5px/1.5 Manrope,sans-serif', color: 'var(--mu)' }}>{t.message}</div>
                  {t.resolution && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--bd)', font: '600 12.5px/1.5 Manrope,sans-serif', color: 'var(--tx)' }}>Respuesta: {t.resolution}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'settings' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '40px 24px 100px', background: 'var(--bg)', color: 'var(--tx)', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <button onClick={() => setStep('account')} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div style={{ font: '800 22px Manrope,sans-serif', letterSpacing: '-.03em' }}>Ajustes</div>
          </div>

          <div style={{ background: 'var(--sf)', borderRadius: '20px', padding: '8px', marginBottom: '24px' }}>
            <button onClick={toggleTheme} style={{ width: '100%', padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
              <div style={{ font: '700 15px Manrope,sans-serif', color: 'var(--tx)' }}>Tema</div>
              <div style={{ font: '600 13px Manrope,sans-serif', color: 'var(--mu)' }}>{theme === 'dark' ? 'Oscuro 🌙' : 'Claro ☀️'}</div>
            </button>
            <div style={{ height: '1px', background: 'var(--bd)', margin: '0 12px' }}></div>
            <button onClick={() => changeLang(lang === 'es' ? 'en' : 'es')} style={{ width: '100%', padding: '16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
              <div style={{ font: '700 15px Manrope,sans-serif', color: 'var(--tx)' }}>Idioma</div>
              <div style={{ font: '600 13px Manrope,sans-serif', color: 'var(--mu)' }}>{lang === 'es' ? 'Español' : 'English'}</div>
            </button>
          </div>

          <button onClick={handleLogout} style={{ width: '100%', height: '56px', borderRadius: '16px', background: 'var(--redS)', color: 'var(--red)', font: '800 16px Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      )}

      {step === 'payments' && (
        <div className="tr-sb" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '40px 24px 100px', background: 'var(--bg)', color: 'var(--tx)', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <button onClick={() => setStep('account')} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--sf)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--tx)" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <div style={{ font: '800 22px Manrope,sans-serif', letterSpacing: '-.03em' }}>Métodos de pago</div>
          </div>

          {paymentMethodsLoading ? (
            <div style={{ color: 'var(--mu)', font: '600 13px Manrope,sans-serif', marginBottom: '20px' }}>Cargando...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {/* Efectivo: siempre disponible, es el default implícito si no hay otro marcado */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', background: 'var(--sf)', border: !paymentMethods.some(m => m.is_default) ? '2px solid var(--jade)' : '2px solid transparent' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '16px', flex: 'none' }}>💵</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 15px Manrope,sans-serif' }}>Efectivo</div>
                  <div style={{ font: '500 12px Manrope,sans-serif', color: 'var(--mu)' }}>Siempre disponible</div>
                </div>
                {!paymentMethods.some(m => m.is_default) && <div style={{ font: '700 11px Manrope,sans-serif', color: 'var(--jade)' }}>Predeterminado</div>}
              </div>

              {paymentMethods.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', background: 'var(--sf)', border: m.is_default ? '2px solid var(--jade)' : '2px solid transparent' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 11px Manrope,sans-serif', flex: 'none' }}>
                    {m.type === 'card' ? '💳' : m.type === 'nequi' ? 'NQ' : 'DP'}
                  </div>
                  <button onClick={() => !m.is_default && handleSetDefaultMethod(m.id)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none' }}>
                    <div style={{ font: '700 15px Manrope,sans-serif' }}>{m.label}</div>
                    <div style={{ font: "500 12px 'IBM Plex Mono',monospace", color: 'var(--mu)' }}>{m.phone_number ? m.phone_number : m.last4 ? `•••• ${m.last4}` : ''}</div>
                  </button>
                  {m.is_default ? (
                    <div style={{ font: '700 11px Manrope,sans-serif', color: 'var(--jade)', flex: 'none' }}>Predeterminado</div>
                  ) : (
                    <button onClick={() => handleDeleteMethod(m.id)} style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--sf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', flex: 'none' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--mu)" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ font: '800 16px Manrope,sans-serif', marginBottom: '12px' }}>Agregar método</div>
          <div style={{ display: 'flex', gap: '9px', marginBottom: '18px' }}>
            {['nequi', 'daviplata', 'card'].map((t) => (
              <button key={t} onClick={() => { setAddMethodType(t); setMethodError(null); }} style={{ flex: 1, padding: '14px 8px', borderRadius: '14px', background: 'var(--sf)', border: addMethodType === t ? '2px solid var(--tx)' : '2px solid transparent', font: '700 13px Manrope,sans-serif' }}>
                {t === 'card' ? '💳 Tarjeta' : t === 'nequi' ? 'Nequi' : 'Daviplata'}
              </button>
            ))}
          </div>

          {(addMethodType === 'nequi' || addMethodType === 'daviplata') && (
            <div style={{ background: 'var(--sf)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ font: '600 12px Manrope,sans-serif', color: 'var(--mu)', marginBottom: '8px' }}>Número de celular {PAYMENT_TYPE_LABEL[addMethodType]}</div>
              <input
                type="tel"
                value={newMethodPhone}
                onChange={(e) => setNewMethodPhone(e.target.value)}
                placeholder="300 000 0000"
                style={{ width: '100%', height: '48px', borderRadius: '12px', border: 'none', background: 'var(--bg)', padding: '0 14px', font: "600 15px 'IBM Plex Mono',monospace", color: 'var(--tx)', outline: 'none', marginBottom: '12px' }}
              />
              {methodError && <div style={{ color: '#d32f2f', fontSize: '13px', marginBottom: '10px' }}>{methodError}</div>}
              <button onClick={handleAddMethod} disabled={savingMethod || !newMethodPhone.trim()} style={{ width: '100%', height: '46px', borderRadius: '12px', background: 'var(--inv)', color: 'var(--invtx)', font: '700 14px Manrope,sans-serif', border: 'none', opacity: savingMethod ? 0.6 : 1 }}>
                {savingMethod ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          )}

          {addMethodType === 'card' && (
            <div style={{ background: 'var(--sf)', borderRadius: '16px', padding: '16px', font: '600 13px/1.5 Manrope,sans-serif', color: 'var(--mu)', marginBottom: '20px' }}>
              Aún no hemos conectado una pasarela de pago para tarjetas (Stripe, Wompi, PayU o MercadoPago). Por seguridad, nunca guardamos números de tarjeta directamente — hace falta activar una de esas pasarelas primero. Mientras tanto, usa Efectivo, Nequi o Daviplata.
            </div>
          )}
        </div>
      )}
    </>
  );
}

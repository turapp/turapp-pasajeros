'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState('splash'); // splash, login, phone, otp, permission
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDevLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: 'user@turapp.co',
        password: 'Turapp-2048',
      });
      if (error) throw error;
      router.push('/home');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión de prueba');
      setLoading(false);
    }
  };

  // Auto-transition splash directly to login
  useEffect(() => {
    if (step === 'splash') {
      const timer = setTimeout(() => setStep('login'), 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: '+57' + phone.replace(/\D/g, ''),
      });
      if (error) throw error;
      setStep('otp');
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Error al enviar SMS');
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: '+57' + phone.replace(/\D/g, ''),
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      
      // Consultar el perfil para ver si es usuario nuevo
      if (data?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', data.user.id)
          .single();
          
        if (!profile?.first_name || profile.first_name === 'Usuario Nuevo') {
          setStep('register');
          setLoading(false);
          return;
        }
      }
      
      setStep('benefits');
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Código incorrecto');
      setLoading(false);
    }
  };

  const handleRegisterProfile = async () => {
    if (!firstName) return;
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          first_name: firstName.trim(), 
          last_name: lastName.trim() 
        })
        .eq('id', user.id);
        
      if (error) throw error;
      
      setStep('benefits');
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Error al guardar el perfil');
      setLoading(false);
    }
  };

  const finishAuth = () => {
    router.push('/home');
  };



  return (
    <>
      {step === 'splash' && (
        <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', animation: 'trPop .7s cubic-bezier(.2,.8,.2,1) both' }}>
            <div style={{ font: '800 48px/1 Manrope,sans-serif', letterSpacing: '-.05em', color: '#fff' }}>Turapp</div>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#33c39c', marginBottom: '8px' }}></div>
          </div>
          <div style={{ position: 'absolute', bottom: '50px', font: '500 11px Manrope,sans-serif', letterSpacing: '.2em', color: 'rgba(255,255,255,.4)' }}>BUENAVENTURA</div>
        </div>
      )}

      {step === 'login' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '60px 24px 40px', background: '#fff', animation: 'trFade .4s ease' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', marginBottom: '24px' }}>
              <div style={{ font: '800 40px/1 Manrope,sans-serif', letterSpacing: '-.05em', color: '#000' }}>Turapp</div>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#33c39c', marginBottom: '6px' }}></div>
            </div>
            <div style={{ font: '800 36px/1.1 Manrope,sans-serif', letterSpacing: '-0.04em', color: '#111', marginBottom: '16px' }}>
              Te damos la<br/>bienvenida
            </div>
            <div style={{ font: '500 16px/1.5 Manrope,sans-serif', color: '#666', marginBottom: '40px' }}>
              Viaja seguro y rápido en Buenaventura y hacia Cali.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Apple */}
            <button onClick={async () => { await supabase.auth.signInWithOAuth({ provider: 'apple' }) }} style={{ width: '100%', height: '56px', borderRadius: '14px', background: '#000', color: '#fff', font: '700 16px Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', border: 'none', transition: 'transform 0.2s ease', cursor: 'pointer' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 13.9c-.03-3.08 2.5-4.56 2.62-4.63-1.44-2.1-3.67-2.39-4.48-2.42-1.9-.19-3.72 1.12-4.69 1.12-.97 0-2.48-1.09-4.04-1.06-2.04.03-3.92 1.19-4.97 2.99-2.14 3.72-.55 9.22 1.53 12.24 1.02 1.49 2.21 3.16 3.82 3.1 1.53-.06 2.11-.99 3.96-.99 1.84 0 2.37.99 3.99.96 1.66-.03 2.69-1.52 3.69-3.01 1.16-1.7 1.64-3.35 1.66-3.44-.04-.01-3.07-1.18-3.09-4.86zM15.02 4.41c.84-1.02 1.41-2.44 1.25-3.86-1.21.05-2.68.81-3.54 1.83-.77.89-1.45 2.33-1.27 3.73 1.36.1 2.73-.67 3.56-1.7z"/></svg>
              Continuar con Apple
            </button>
            
            {/* Google */}
            <button onClick={async () => { await supabase.auth.signInWithOAuth({ provider: 'google' }) }} style={{ width: '100%', height: '56px', borderRadius: '14px', background: '#fff', color: '#111', font: '700 16px Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', border: '1px solid #eaeaea', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', transition: 'transform 0.2s ease', cursor: 'pointer' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continuar con Google
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '8px 0' }}>
              <div style={{ height: '1px', flex: 1, background: '#f0f0f0' }}></div>
              <div style={{ font: '600 12px Manrope,sans-serif', color: '#999', letterSpacing: '0.05em' }}>O</div>
              <div style={{ height: '1px', flex: 1, background: '#f0f0f0' }}></div>
            </div>
            {/* Phone */}
            <button onClick={() => setStep('phone')} style={{ width: '100%', height: '56px', borderRadius: '16px', background: '#f4f4f3', color: '#111', font: '800 16px Manrope,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', cursor: 'pointer' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
              Continuar con teléfono
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '32px', font: '500 12px/1.5 Manrope,sans-serif', color: '#999' }}>
            Al continuar, aceptas nuestros <span style={{ color: '#111', textDecoration: 'underline' }}>Términos</span> y <span style={{ color: '#111', textDecoration: 'underline' }}>Privacidad</span>.
          </div>

          {/* DEV ONLY: acceso rápido con la cuenta de prueba mientras no haya SMS/OAuth configurados. Quitar antes de producción. */}
          <button onClick={handleDevLogin} disabled={loading} style={{ marginTop: '16px', height: '44px', borderRadius: '12px', background: 'none', border: '1px dashed #ccc', color: '#666', font: '700 13px Manrope,sans-serif', width: '100%' }}>
            {loading ? 'Entrando...' : '🧪 Entrar con cuenta de prueba (dev)'}
          </button>
          {error && <div style={{ color: '#d32f2f', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>{error}</div>}
        </div>
      )}

      {step === 'phone' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '60px 24px 24px', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)', background: '#fff' }}>
          <button onClick={() => setStep('login')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div style={{ font: '800 28px/1.1 Manrope,sans-serif', letterSpacing: '-.04em', marginBottom: '24px', color: '#111' }}>Ingresa tu celular</div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: '56px', borderRadius: '14px', background: '#f5f5f5' }}>
              <div style={{ font: '700 16px Manrope,sans-serif', color: '#111' }}>+57</div>
            </div>
            <input 
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 000 0000"
              style={{ flex: 1, height: '56px', borderRadius: '14px', background: '#f5f5f5', border: 'none', padding: '0 16px', font: "600 18px 'IBM Plex Mono',monospace", color: '#111', outline: 'none' }}
            />
          </div>
          <div style={{ font: '500 13px/1.5 Manrope,sans-serif', color: '#666' }}>Te enviaremos un código SMS para verificar.</div>
          {error && <div style={{ color: '#d32f2f', fontSize: '13px', marginTop: '12px' }}>{error}</div>}
          <div style={{ flex: 1 }}></div>
          <button onClick={handleSendOtp} disabled={loading || !phone} style={{ height: '56px', borderRadius: '14px', background: phone ? '#000' : '#e0e0e0', color: phone ? '#fff' : '#999', font: '700 16px Manrope,sans-serif', width: '100%', marginBottom: '12px', border: 'none', transition: 'background 0.2s' }}>{loading ? 'Enviando...' : 'Continuar'}</button>
        </div>
      )}
      
      {step === 'otp' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '60px 24px 24px', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)', background: '#fff' }}>
          <button onClick={() => setStep('phone')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', border: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div style={{ font: '800 28px/1.1 Manrope,sans-serif', letterSpacing: '-.04em', marginBottom: '8px', color: '#111' }}>Código de 6 dígitos</div>
          <div style={{ font: '500 15px/1.5 Manrope,sans-serif', color: '#666', marginBottom: '32px' }}>Enviado a +57 {phone}</div>
          
          <input 
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="000000"
            style={{ height: '64px', borderRadius: '16px', background: '#f5f5f5', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', font: "600 28px 'IBM Plex Mono',monospace", letterSpacing: '0.3em', color: '#111', outline: 'none' }}
          />
          {error && <div style={{ color: '#d32f2f', fontSize: '13px', marginTop: '12px' }}>{error}</div>}
          <div style={{ flex: 1 }}></div>
          <button onClick={handleVerifyOtp} disabled={loading || otp.length < 6} style={{ height: '56px', borderRadius: '14px', background: otp.length >= 6 ? '#000' : '#e0e0e0', color: otp.length >= 6 ? '#fff' : '#999', font: '700 16px Manrope,sans-serif', width: '100%', marginBottom: '12px', border: 'none', transition: 'background 0.2s' }}>{loading ? 'Verificando...' : 'Verificar'}</button>
        </div>
      )}

      {step === 'register' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: '60px 24px 24px', animation: 'trSlideL .28s cubic-bezier(.2,.8,.2,1)', background: '#fff' }}>
          <div style={{ font: '800 28px/1.1 Manrope,sans-serif', letterSpacing: '-.04em', marginBottom: '8px', color: '#111' }}>Crea tu cuenta</div>
          <div style={{ font: '500 15px/1.5 Manrope,sans-serif', color: '#666', marginBottom: '32px' }}>¿Cómo te llamas?</div>
          
          <input 
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Nombre"
            style={{ height: '56px', borderRadius: '14px', background: '#f5f5f5', border: 'none', padding: '0 16px', font: "600 16px Manrope,sans-serif", color: '#111', outline: 'none', marginBottom: '12px' }}
          />
          <input 
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Apellido (opcional)"
            style={{ height: '56px', borderRadius: '14px', background: '#f5f5f5', border: 'none', padding: '0 16px', font: "600 16px Manrope,sans-serif", color: '#111', outline: 'none' }}
          />
          {error && <div style={{ color: '#d32f2f', fontSize: '13px', marginTop: '12px' }}>{error}</div>}
          <div style={{ flex: 1 }}></div>
          <button onClick={handleRegisterProfile} disabled={loading || !firstName} style={{ height: '56px', borderRadius: '14px', background: firstName ? '#000' : '#e0e0e0', color: firstName ? '#fff' : '#999', font: '700 16px Manrope,sans-serif', width: '100%', marginBottom: '12px', border: 'none', transition: 'background 0.2s' }}>{loading ? 'Guardando...' : 'Continuar'}</button>
        </div>
      )}

      {step === 'benefits' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', animation: 'trSlideL .3s ease', background: '#fff' }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 30px' }}>
            <img src="/images/car.png" alt="" style={{ width: '220px', height: '220px', objectFit: 'contain', animation: 'trPop .5s cubic-bezier(.2,.8,.2,1) both' }} />
          </div>
          <div style={{ padding: '32px 24px 40px' }}>
            <div style={{ font: '800 28px/1.14 Manrope,sans-serif', letterSpacing: '-.04em', marginBottom: '12px', color: '#111' }}>Viaja seguro, viaja fácil</div>
            <div style={{ font: '500 15px/1.6 Manrope,sans-serif', color: '#666', marginBottom: '32px' }}>Pide un viaje en segundos y te recogemos donde estés. Disfruta de la mejor experiencia en Buenaventura.</div>
            <button onClick={() => setStep('permission')} style={{ height: '56px', borderRadius: '14px', background: '#000', color: '#fff', font: '700 16px Manrope,sans-serif', width: '100%', marginBottom: '12px', border: 'none' }}>Siguiente</button>
          </div>
        </div>
      )}

      {step === 'permission' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff', animation: 'trFade .3s ease' }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 30px' }}>
            <div style={{ width: '100%', maxWidth: '290px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ borderRadius: '16px', background: '#fff', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', opacity: .7, transform: 'scale(.92) translateY(14px)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', font: '800 16px Manrope,sans-serif', color: '#fff' }}>T</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '800 13px Manrope,sans-serif', color: '#111' }}>Tu conductor llegó</div>
                  <div style={{ font: '500 12px Manrope,sans-serif', color: '#666', marginTop: '2px' }}>Sal ahora, te está esperando.</div>
                </div>
              </div>
              <div style={{ borderRadius: '16px', background: '#fff', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', font: '800 16px Manrope,sans-serif', color: '#fff' }}>T</div>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '800 13px Manrope,sans-serif', color: '#111' }}>Descuento 50%</div>
                  <div style={{ font: '500 12px Manrope,sans-serif', color: '#666', marginTop: '2px' }}>En tu próximo viaje al aeropuerto.</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: '32px 24px 40px' }}>
            <div style={{ font: '800 28px/1.1 Manrope,sans-serif', letterSpacing: '-.04em', marginBottom: '12px', color: '#111' }}>No te pierdas de nada</div>
            <div style={{ font: '500 15px/1.5 Manrope,sans-serif', color: '#666', marginBottom: '32px' }}>Activa las notificaciones para saber cuándo llega tu conductor y recibir promociones.</div>
            <button onClick={finishAuth} style={{ height: '56px', borderRadius: '14px', background: '#000', color: '#fff', font: '700 16px Manrope,sans-serif', width: '100%', marginBottom: '12px', border: 'none' }}>Activar notificaciones</button>
            <button onClick={finishAuth} style={{ height: '46px', borderRadius: '14px', background: 'none', color: '#666', font: '700 15px Manrope,sans-serif', width: '100%', border: 'none' }}>Quizás más tarde</button>
          </div>
        </div>
      )}
    </>
  );
}

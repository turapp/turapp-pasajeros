import { NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from './lib/supabaseServer';

// Rutas que NO requieren autenticación
const PUBLIC_ROUTES = ['/', '/driver/onboarding'];

// Rutas exclusivas de conductor
const DRIVER_ROUTES = ['/driver'];

export async function middleware(request) {
  const url = request.nextUrl.clone();
  const { pathname } = url;

  // No interceptar assets estáticos ni API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.') // archivos estáticos (favicon, manifest, sw.js, etc.)
  ) {
    return NextResponse.next();
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request);

  // Obtener sesión actual
  const { data: { user } } = await supabase.auth.getUser();

  // --- Rewrite por subdominio (driver.turapp.co → /driver) ---
  const host = request.headers.get('host') || '';
  if (pathname === '/' && host.includes('driver.')) {
    if (!user) {
      url.pathname = '/driver/onboarding';
      return NextResponse.redirect(url);
    }
    url.pathname = '/driver';
    return NextResponse.rewrite(url);
  }

  // --- Rutas públicas: si ya está autenticado, redirigir al home ---
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (user) {
      // Verificar rol para redirigir al home correcto
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, is_approved')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'driver') {
        if (!profile.is_approved) {
          // Conductor no aprobado → mandarlo a onboarding
          if (pathname !== '/driver/onboarding') {
            url.pathname = '/driver/onboarding';
            return NextResponse.redirect(url);
          }
          return response;
        }
        url.pathname = '/driver';
        return NextResponse.redirect(url);
      }
      url.pathname = '/home';
      return NextResponse.redirect(url);
    }
    return response;
  }

  // --- Rutas protegidas: si NO está autenticado, redirigir al login ---
  if (!user) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // --- Verificar rol para rutas de conductor ---
  if (DRIVER_ROUTES.some(r => pathname.startsWith(r))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_approved')
      .eq('id', user.id)
      .single();

    // Si no es conductor, redirigir a home de pasajero
    if (profile?.role !== 'driver') {
      url.pathname = '/home';
      return NextResponse.redirect(url);
    }

    // Si es conductor pero no aprobado, solo puede ver onboarding
    if (!profile.is_approved && pathname !== '/driver/onboarding') {
      url.pathname = '/driver/onboarding';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

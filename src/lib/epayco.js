'use client';

// Tokenización de tarjeta con ePayco — SOLO genera un token, no cobra nada.
// Verificado contra la documentación oficial (docs.epayco.com/docs/tokenizacion-de-clientes):
// requiere jQuery + epayco.min.js, y opera sobre un <form> real con inputs
// marcados data-epayco="card[...]". El token vuelve como el propio valor
// del segundo parámetro del callback (no anidado en .id ni .data.id).
// Los datos de la tarjeta van del navegador directo a los servidores de
// ePayco; nuestro backend nunca los toca ni los guarda.

const EPAYCO_SCRIPT_URL = 'https://checkout.epayco.co/epayco.min.js';
const JQUERY_URL = 'https://code.jquery.com/jquery-3.7.1.min.js';

function loadScript(src, globalCheck) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Solo en el navegador'));
  if (globalCheck()) return Promise.resolve();
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`No se pudo cargar ${src}`)));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.appendChild(script);
  });
}

let readyPromise = null;

async function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await loadScript(JQUERY_URL, () => typeof window.jQuery !== 'undefined');
      await loadScript(EPAYCO_SCRIPT_URL, () => typeof window.ePayco !== 'undefined');
      const publicKey = process.env.NEXT_PUBLIC_EPAYCO_PUBLIC_KEY;
      if (!publicKey) throw new Error('Falta NEXT_PUBLIC_EPAYCO_PUBLIC_KEY');
      window.ePayco.setPublicKey(publicKey);
    })();
  }
  return readyPromise;
}

// formEl: el <form> del DOM cuyos inputs tienen data-epayco="card[...]"
export async function tokenizeCardForm(formEl) {
  await ensureReady();
  const $ = window.jQuery;
  const $form = $(formEl);

  return new Promise((resolve, reject) => {
    window.ePayco.token.create($form, (error, token) => {
      if (error) {
        reject(new Error(error?.data?.description || 'No se pudo verificar la tarjeta.'));
      } else {
        resolve(token);
      }
    });
  });
}

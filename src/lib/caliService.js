import { supabase } from './supabaseClient';

export const caliService = {
  // Obtener salidas con datos del vehículo y conductor
  async getDepartures() {
    const { data, error } = await supabase
      .from('cali_departures')
      .select(`
        id,
        departure_time,
        current_price,
        current_block,
        total_seats,
        occupied_seats,
        status,
        vehicles ( plate ),
        driver_profiles (
          profiles ( first_name, last_name )
        ),
        cali_seats ( status )
      `)
      .order('departure_time', { ascending: true });

    if (error) {
      console.error('Error fetching departures:', error.message, error.details, error.hint);
      return [];
    }

    return data;
  },

  // Obtener salidas de un conductor específico
  async getDriverDepartures(driverId) {
    const { data, error } = await supabase
      .from('cali_departures')
      .select(`
        id,
        departure_time,
        current_price,
        current_block,
        total_seats,
        occupied_seats,
        status,
        vehicles ( plate ),
        cali_seats ( status )
      `)
      .eq('driver_id', driverId)
      .order('departure_time', { ascending: true });

    if (error) {
      console.error('Error fetching driver departures:', error.message, error.details, error.hint);
      return [];
    }

    return data;
  },

  // Obtener estado de los asientos para un viaje específico
  async getSeats(departureId) {
    const { data, error } = await supabase
      .from('cali_seats')
      .select('*')
      .eq('departure_id', departureId)
      .order('seat_number', { ascending: true });
      
    if (error) {
      console.error('Error fetching seats:', error);
      return [];
    }
    return data;
  },

  // Reservar un asiento (vía Edge Function: calcula precio, abono y registra el pago server-side)
  async reserveSeat(seatId, departureId) {
    const { data, error } = await supabase.functions.invoke('reserve-seat', {
      body: { seat_id: seatId, departure_id: departureId },
    });

    if (error) {
      // El Edge Function devuelve { error: mensaje } en el body incluso en fallos 4xx
      const body = await error.context?.json?.().catch(() => null);
      console.error('Error reserving seat:', body?.error || error.message);
      throw new Error(body?.error || 'No se pudo reservar el puesto.');
    }
    return data;
  },

  // Suscribirse a cambios en los asientos en tiempo real
  subscribeToSeats(departureId, callback) {
    const subscription = supabase
      .channel(`seats-${departureId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'cali_seats',
          filter: `departure_id=eq.${departureId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }
};

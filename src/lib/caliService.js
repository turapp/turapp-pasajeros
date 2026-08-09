import { supabase } from './supabaseClient';

export const caliService = {
  // Obtener salidas con datos del vehículo y conductor
  async getDepartures() {
    const { data, error } = await supabase
      .from('cali_departures')
      .select(`
        id,
        departure_time,
        price_block,
        status,
        vehicles ( license_plate ),
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
        price_block,
        status,
        vehicles ( license_plate ),
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

  // Reservar un asiento
  async reserveSeat(seatId, riderId, price) {
    // 30% del precio total como abono
    const deposit = price * 0.3;
    const balance = price * 0.7;

    const { data, error } = await supabase
      .from('cali_seats')
      .update({ 
        status: 'reserved', 
        rider_id: riderId,
        deposit_paid: deposit,
        balance_due: balance
      })
      .eq('id', seatId)
      .eq('status', 'available') // Optimistic concurrency check
      .select()
      .single();

    if (error) {
      console.error('Error reserving seat:', error);
      throw error;
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

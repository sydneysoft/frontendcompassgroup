const cfg = window.BUS_APP_CONFIG || {};
const base = cfg.apiBaseUrl || 'http://localhost:8000/api/v1';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let body = null;
  const text = await response.text();
  if (text) {
    try { body = JSON.parse(text); } catch { body = { detail: text }; }
  }
  if (!response.ok) {
    const error = new Error(body?.detail || `Request failed (${response.status})`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export const api = {
  locations: (q) => request(`/locations?q=${encodeURIComponent(q)}`),
  search: (payload) => request('/searches', { method:'POST', body:JSON.stringify(payload) }),
  createSession: (journeyId) => request('/booking-sessions', { method:'POST', body:JSON.stringify({ journey_id:journeyId }) }),
  createBooking: (payload) => request('/bookings', { method:'POST', body:JSON.stringify(payload) }),
  paymentMethods: () => request('/payments/methods'),
  createPayment: (payload) => request('/payments', { method:'POST', body:JSON.stringify(payload) }),
  devSucceed: (paymentId) => request(`/payments/${paymentId}/dev-succeed`, { method:'POST' }),
  getBooking: (reference,email) => request(`/bookings/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`),
  cancelBooking: (reference,email) => request(`/bookings/${encodeURIComponent(reference)}/cancel`, { method:'POST', body:JSON.stringify({email}) })
};

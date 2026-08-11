const config = window.BUS_APP_CONFIG || {};
const API_BASE = config.API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
const BRAND_NAME = config.BRAND_NAME || 'Busly';

const state = {
  search: null,
  searchPayload: null,
  journeys: [],
  selectedJourney: null,
  bookingSession: null,
  booking: null,
  paymentMethods: [],
  selectedPaymentMethod: null,
  contact: null,
  lastConfirmedBooking: null,
};

const $ = (id) => document.getElementById(id);
const views = [...document.querySelectorAll('.view')];

function setBrand() {
  document.querySelectorAll('[data-brand]').forEach((node) => { node.textContent = BRAND_NAME; });
  document.title = `${BRAND_NAME} — Bus tickets across Europe`;
}

function showView(id) {
  views.forEach((view) => view.classList.toggle('active', view.id === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function showError(element, error) {
  const message = error instanceof Error ? error.message : String(error || 'Something went wrong.');
  element.textContent = message;
  element.hidden = false;
}

function clearError(element) {
  element.textContent = '';
  element.hidden = true;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  let body = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) body = await response.json();
  else body = await response.text();

  if (!response.ok) {
    const detail = body && typeof body === 'object' ? body.detail : body;
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return body;
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(value) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).format(parseDateOnly(value));
}

function formatDateTime(value) {
  const date = new Date(value);
  return {
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date),
    date: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date),
  };
}

function formatMoney(amount, currency) {
  const numeric = Number(amount);
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(numeric);
  } catch {
    return `${numeric.toFixed(2)} ${currency}`;
  }
}

function durationLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function amenityLabel(value) {
  const labels = {
    wifi: 'Wi‑Fi',
    power: 'Power',
    air_conditioning: 'A/C',
    toilet: 'Toilet',
    usb: 'USB',
  };
  return labels[value] || value.replaceAll('_', ' ');
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function setDefaultDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  $('departureInput').min = localDateString(new Date());
  $('departureInput').value = localDateString(tomorrow);
}

function debounce(fn, delay = 220) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function loadSuggestions(input, box) {
  const q = input.value.trim();
  if (q.length < 2) {
    box.hidden = true;
    box.innerHTML = '';
    return;
  }
  try {
    const data = await api(`/locations?q=${encodeURIComponent(q)}`);
    const items = data.items || [];
    if (!items.length) {
      box.hidden = true;
      return;
    }
    box.innerHTML = items.map((item) => `
      <button class="suggestion-item" type="button" data-location="${escapeHtml(item.name)}">
        <span><strong>${escapeHtml(item.name)}</strong><br><small>${escapeHtml(item.type || 'location')}</small></span>
        <small>${escapeHtml(item.country || '')}</small>
      </button>
    `).join('');
    box.hidden = false;
    box.querySelectorAll('[data-location]').forEach((button) => {
      button.addEventListener('click', () => {
        input.value = button.dataset.location;
        box.hidden = true;
      });
    });
  } catch {
    box.hidden = true;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderDateStrip() {
  const strip = $('dateStrip');
  const current = parseDateOnly(state.searchPayload.departure_date);
  const dates = [-1, 0, 1, 2, 3].map((offset) => {
    const d = new Date(current);
    d.setDate(d.getDate() + offset);
    return localDateString(d);
  });
  strip.innerHTML = dates.map((date) => `
    <button class="date-chip ${date === state.searchPayload.departure_date ? 'active' : ''}" type="button" data-date="${date}">
      <strong>${formatDay(date)}</strong>
      <span>${date === state.searchPayload.departure_date ? 'Selected' : 'Search date'}</span>
    </button>
  `).join('');
  strip.querySelectorAll('[data-date]').forEach((button) => {
    button.addEventListener('click', async () => {
      $('departureInput').value = button.dataset.date;
      await performSearch({ ...state.searchPayload, departure_date: button.dataset.date });
    });
  });
}

function getFilteredJourneys() {
  let journeys = [...state.journeys];
  if ($('directOnly').checked) journeys = journeys.filter((journey) => Number(journey.transfers) === 0);
  if ($('refundableOnly').checked) journeys = journeys.filter((journey) => journey.refundable);

  const sort = $('sortSelect').value;
  if (sort === 'price') journeys.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === 'departure') journeys.sort((a, b) => new Date(a.departure_at) - new Date(b.departure_at));
  if (sort === 'duration') journeys.sort((a, b) => a.duration_minutes - b.duration_minutes);
  if (sort === 'recommended') journeys.sort((a, b) => (a.transfers - b.transfers) || (Number(a.price) - Number(b.price)));
  return journeys;
}

function renderJourneys() {
  const journeys = getFilteredJourneys();
  $('noResults').hidden = journeys.length > 0;
  $('journeyList').innerHTML = journeys.map((journey) => {
    const departure = formatDateTime(journey.departure_at);
    const arrival = formatDateTime(journey.arrival_at);
    const transferLabel = journey.transfers === 0 ? 'Direct' : `${journey.transfers} transfer${journey.transfers > 1 ? 's' : ''}`;
    const seatLabel = journey.available_seats == null ? 'Availability on request' : `${journey.available_seats} seats left`;
    return `
      <article class="journey-card">
        <div class="journey-top">
          <div class="operator">
            <div class="operator-badge">${escapeHtml(initials(journey.operator_name))}</div>
            <div>
              <strong>${escapeHtml(journey.operator_name)}</strong>
              <small>${escapeHtml(transferLabel)} · ${escapeHtml(seatLabel)}</small>
              ${journey.refundable ? '<span class="badge green">Refundable</span>' : '<span class="badge orange">Standard fare</span>'}
            </div>
          </div>
          <div class="price">
            <strong>${formatMoney(journey.price, journey.currency)}</strong>
            <small>per booking</small>
          </div>
        </div>
        <div class="journey-main">
          <div>
            <div class="stop-time">${departure.time}</div>
            <div class="stop-station"><strong>${escapeHtml(journey.origin_name)}</strong><br>${escapeHtml(journey.origin_station)} · ${departure.date}</div>
          </div>
          <div class="journey-line">
            <span>${durationLabel(journey.duration_minutes)} · ${escapeHtml(transferLabel)}</span>
            <div class="line"></div>
          </div>
          <div>
            <div class="stop-time">${arrival.time}</div>
            <div class="stop-station"><strong>${escapeHtml(journey.destination_name)}</strong><br>${escapeHtml(journey.destination_station)} · ${arrival.date}</div>
          </div>
        </div>
        <div class="journey-footer">
          <div class="amenities">
            ${(journey.amenities || []).map((item) => `<span class="amenity">${escapeHtml(amenityLabel(item))}</span>`).join('') || '<span class="amenity">Standard coach</span>'}
          </div>
          <button class="primary-button" type="button" data-select-journey="${journey.id}">Select</button>
        </div>
      </article>
    `;
  }).join('');

  $('journeyList').querySelectorAll('[data-select-journey]').forEach((button) => {
    button.addEventListener('click', () => selectJourney(button.dataset.selectJourney));
  });
}

async function performSearch(payload) {
  clearError($('resultsError'));
  $('resultsSection').hidden = false;
  $('featuresSection').hidden = true;
  $('journeyList').innerHTML = '';
  $('resultsLoading').hidden = false;
  $('noResults').hidden = true;
  $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const data = await api('/searches', { method: 'POST', body: JSON.stringify(payload) });
    state.search = data;
    state.searchPayload = payload;
    state.journeys = data.journeys || [];
    $('resultsTitle').textContent = `${payload.origin} → ${payload.destination}`;
    const passengers = Number(payload.passengers.adults) + Number(payload.passengers.children);
    $('resultsMeta').textContent = `${formatDay(payload.departure_date)} · ${passengers} passenger${passengers !== 1 ? 's' : ''} · ${state.journeys.length} departures`;
    renderDateStrip();
    renderJourneys();
  } catch (error) {
    showError($('resultsError'), `${error.message}. Make sure the backend is running on http://127.0.0.1:8000.`);
  } finally {
    $('resultsLoading').hidden = true;
  }
}

async function selectJourney(id) {
  const journey = state.journeys.find((item) => item.id === id);
  if (!journey) return;
  state.selectedJourney = journey;
  showToast('Checking live price and availability…');
  try {
    const bookingSession = await api('/booking-sessions', {
      method: 'POST',
      body: JSON.stringify({ journey_id: journey.id }),
    });
    state.bookingSession = bookingSession;
    renderCheckout();
    showView('checkoutView');
    if (bookingSession.price_changed) showToast('The provider returned an updated price.');
  } catch (error) {
    showError($('resultsError'), error);
    $('resultsSection').scrollIntoView({ behavior: 'smooth' });
  }
}

function passengerCount() {
  if (!state.searchPayload) return { adults: 1, children: 0 };
  return state.searchPayload.passengers;
}

function renderPassengerForms() {
  const container = $('passengerForms');
  const { adults, children } = passengerCount();
  const passengers = [];
  for (let i = 0; i < adults; i += 1) passengers.push({ type: 'adult', label: `Adult ${i + 1}` });
  for (let i = 0; i < children; i += 1) passengers.push({ type: 'child', label: `Child ${i + 1}` });

  container.innerHTML = passengers.map((passenger, index) => `
    <section class="passenger-block" data-passenger-index="${index}" data-passenger-type="${passenger.type}">
      <h3>Passenger ${index + 1} <span>${passenger.label}</span></h3>
      <div class="two-columns">
        <label class="field">
          <span>First name</span>
          <input data-field="first_name" type="text" required maxlength="120" />
        </label>
        <label class="field">
          <span>Last name</span>
          <input data-field="last_name" type="text" required maxlength="120" />
        </label>
      </div>
      <div class="two-columns" style="margin-top:12px">
        <label class="field">
          <span>Date of birth (optional)</span>
          <input data-field="date_of_birth" type="date" />
        </label>
        <label class="field">
          <span>Nationality (optional)</span>
          <input data-field="nationality" type="text" maxlength="3" placeholder="GBR" />
        </label>
      </div>
    </section>
  `).join('');
}

function journeySummaryHtml(journey) {
  const departure = formatDateTime(journey.departure_at);
  const arrival = formatDateTime(journey.arrival_at);
  return `
    <div class="summary-route">${escapeHtml(journey.origin_name)} → ${escapeHtml(journey.destination_name)}</div>
    <div class="summary-row"><span>Operator</span><strong>${escapeHtml(journey.operator_name)}</strong></div>
    <div class="summary-row"><span>Departure</span><strong>${departure.date}, ${departure.time}</strong></div>
    <div class="summary-row"><span>Arrival</span><strong>${arrival.date}, ${arrival.time}</strong></div>
    <div class="summary-row"><span>Duration</span><strong>${durationLabel(journey.duration_minutes)}</strong></div>
  `;
}

function renderCheckout() {
  clearError($('checkoutAlert'));
  renderPassengerForms();
  $('checkoutJourneySummary').innerHTML = journeySummaryHtml(state.selectedJourney);
  $('checkoutTotal').textContent = formatMoney(state.bookingSession.amount, state.bookingSession.currency);
}

function collectPassengers() {
  return [...document.querySelectorAll('.passenger-block')].map((block) => {
    const get = (name) => block.querySelector(`[data-field="${name}"]`).value.trim();
    const nationality = get('nationality').toUpperCase();
    return {
      first_name: get('first_name'),
      last_name: get('last_name'),
      passenger_type: block.dataset.passengerType,
      date_of_birth: get('date_of_birth') || null,
      nationality: nationality || null,
      document_type: null,
      document_number: null,
    };
  });
}

async function createBooking(event) {
  event.preventDefault();
  clearError($('checkoutAlert'));
  const contactEmail = $('contactEmail').value.trim();
  const contactPhone = $('contactPhone').value.trim();
  const passengers = collectPassengers();
  state.contact = { email: contactEmail, phone: contactPhone };
  $('continuePaymentButton').disabled = true;
  $('continuePaymentButton').textContent = 'Creating booking…';

  try {
    const booking = await api('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        booking_session_id: state.bookingSession.id,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        passengers,
      }),
    });
    state.booking = booking;
    await loadPaymentMethods();
    renderPaymentMethods();
    showView('paymentView');
  } catch (error) {
    showError($('checkoutAlert'), error);
  } finally {
    $('continuePaymentButton').disabled = false;
    $('continuePaymentButton').textContent = 'Continue to payment →';
  }
}

async function loadPaymentMethods() {
  if (state.paymentMethods.length) return;
  state.paymentMethods = await api('/payments/methods');
}

function paymentIcon(method) {
  const icons = {
    visa: 'VISA',
    mastercard: 'MC',
    apple_pay: 'Pay',
    google_pay: 'G Pay',
    paypal: 'PayPal',
  };
  return icons[method.id] || method.label;
}

function renderPaymentMethods() {
  state.selectedPaymentMethod = null;
  $('payButton').disabled = true;
  $('payButton').textContent = `Pay ${formatMoney(state.booking.amount, state.booking.currency)}`;
  $('paymentMethods').innerHTML = state.paymentMethods.map((method) => `
    <label class="payment-option" data-payment-option="${method.id}">
      <input type="radio" name="payment_method" value="${method.id}" />
      <span class="payment-logo">${escapeHtml(paymentIcon(method))}</span>
      <span><strong>${escapeHtml(method.label)}</strong><br><small>${method.kind === 'card' ? 'Card payment' : 'Digital wallet'}</small></span>
      <span>›</span>
    </label>
  `).join('');

  $('paymentMethods').querySelectorAll('input[name="payment_method"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      state.selectedPaymentMethod = radio.value;
      $('paymentMethods').querySelectorAll('.payment-option').forEach((node) => node.classList.toggle('selected', node.contains(radio) && radio.checked));
      $('payButton').disabled = false;
    });
  });
}

function idempotencyKey() {
  if (globalThis.crypto?.randomUUID) return `web_${crypto.randomUUID()}`;
  return `web_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function pay() {
  clearError($('paymentError'));
  if (!state.selectedPaymentMethod || !state.booking) return;
  $('payButton').disabled = true;
  $('payButton').textContent = 'Processing sandbox payment…';

  try {
    const payment = await api('/payments', {
      method: 'POST',
      body: JSON.stringify({
        booking_id: state.booking.id,
        method: state.selectedPaymentMethod,
        idempotency_key: idempotencyKey(),
        return_url: window.location.href,
      }),
    });

    await api(`/payments/${encodeURIComponent(payment.id)}/dev-succeed`, { method: 'POST' });
    const confirmed = await api(`/bookings/${encodeURIComponent(state.booking.reference)}?email=${encodeURIComponent(state.contact.email)}`);
    state.lastConfirmedBooking = confirmed;
    state.booking = confirmed;
    renderConfirmation();
    showView('confirmationView');
  } catch (error) {
    showError($('paymentError'), error);
  } finally {
    $('payButton').disabled = false;
    $('payButton').textContent = state.booking ? `Pay ${formatMoney(state.booking.amount, state.booking.currency)}` : 'Pay securely';
  }
}

function renderConfirmation() {
  const booking = state.lastConfirmedBooking;
  const ticket = booking.tickets?.[0];
  $('confirmationCard').innerHTML = `
    ${journeySummaryHtml(state.selectedJourney)}
    <div class="booking-reference"><span>Booking reference</span><strong>${escapeHtml(booking.reference)}</strong></div>
    <div class="summary-row"><span>Status</span><strong>${escapeHtml(booking.status)}</strong></div>
    <div class="summary-row"><span>Total paid</span><strong>${formatMoney(booking.amount, booking.currency)}</strong></div>
    <div class="summary-row"><span>Email</span><strong>${escapeHtml(booking.contact_email)}</strong></div>
    ${ticket ? `
      <div class="ticket-box">
        <strong>Test ticket</strong>
        <div class="summary-row"><span>Ticket number</span><strong>${escapeHtml(ticket.ticket_number || ticket.id)}</strong></div>
        ${ticket.qr_text ? `<code>${escapeHtml(ticket.qr_text)}</code>` : ''}
      </div>` : '<p class="muted">The provider did not return a ticket yet.</p>'}
  `;
  $('manageReference').value = booking.reference;
  $('manageEmail').value = booking.contact_email;
}

async function lookupBooking(event) {
  event?.preventDefault();
  clearError($('manageError'));
  $('managedBookingCard').hidden = true;
  const reference = $('manageReference').value.trim().toUpperCase();
  const email = $('manageEmail').value.trim();
  try {
    const booking = await api(`/bookings/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`);
    renderManagedBooking(booking, email);
  } catch (error) {
    showError($('manageError'), error);
  }
}

function renderManagedBooking(booking, email) {
  const ticket = booking.tickets?.[0];
  const cancellable = !['cancelled', 'refunded', 'refund_pending'].includes(booking.status);
  $('managedBookingCard').innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
      <div>
        <p class="eyebrow dark">REFERENCE ${escapeHtml(booking.reference)}</p>
        <h2 style="margin:0 0 7px">${formatMoney(booking.amount, booking.currency)}</h2>
      </div>
      <span class="booking-status">${escapeHtml(booking.status)}</span>
    </div>
    <div class="summary-row"><span>Email</span><strong>${escapeHtml(booking.contact_email)}</strong></div>
    <div class="summary-row"><span>Phone</span><strong>${escapeHtml(booking.contact_phone)}</strong></div>
    <div class="summary-row"><span>Provider booking ID</span><strong>${escapeHtml(booking.provider_booking_id || 'Pending')}</strong></div>
    ${ticket ? `<div class="ticket-box"><strong>Ticket</strong><div class="summary-row"><span>Number</span><strong>${escapeHtml(ticket.ticket_number || ticket.id)}</strong></div>${ticket.qr_text ? `<code>${escapeHtml(ticket.qr_text)}</code>` : ''}</div>` : ''}
    ${cancellable ? '<button id="cancelManagedBooking" class="cancel-button" type="button" style="margin-top:16px">Cancel / refund booking</button>' : ''}
  `;
  $('managedBookingCard').hidden = false;
  const cancel = $('cancelManagedBooking');
  if (cancel) {
    cancel.addEventListener('click', async () => {
      if (!window.confirm('Cancel this booking and start the refund flow?')) return;
      cancel.disabled = true;
      cancel.textContent = 'Cancelling…';
      try {
        const updated = await api(`/bookings/${encodeURIComponent(booking.reference)}/cancel`, {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        renderManagedBooking(updated, email);
        showToast('Booking cancellation/refund processed.');
      } catch (error) {
        showError($('manageError'), error);
        cancel.disabled = false;
        cancel.textContent = 'Cancel / refund booking';
      }
    });
  }
}

function wireEvents() {
  $('searchForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      origin: $('originInput').value.trim(),
      destination: $('destinationInput').value.trim(),
      departure_date: $('departureInput').value,
      return_date: null,
      passengers: {
        adults: Number($('adultsInput').value),
        children: Number($('childrenInput').value),
      },
      currency: $('currencyInput').value,
    };
    await performSearch(payload);
  });

  $('originInput').addEventListener('input', debounce(() => loadSuggestions($('originInput'), $('originSuggestions'))));
  $('destinationInput').addEventListener('input', debounce(() => loadSuggestions($('destinationInput'), $('destinationSuggestions'))));
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.location-field')) {
      $('originSuggestions').hidden = true;
      $('destinationSuggestions').hidden = true;
    }
  });

  $('swapButton').addEventListener('click', () => {
    const temp = $('originInput').value;
    $('originInput').value = $('destinationInput').value;
    $('destinationInput').value = temp;
  });

  document.querySelectorAll('[data-route-from]').forEach((button) => {
    button.addEventListener('click', () => {
      $('originInput').value = button.dataset.routeFrom;
      $('destinationInput').value = button.dataset.routeTo;
      $('searchForm').requestSubmit();
    });
  });

  ['sortSelect', 'directOnly', 'refundableOnly'].forEach((id) => $(id).addEventListener('change', renderJourneys));
  $('clearFiltersButton').addEventListener('click', () => {
    $('sortSelect').value = 'recommended';
    $('directOnly').checked = false;
    $('refundableOnly').checked = false;
    renderJourneys();
  });

  $('editSearchButton').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('originInput').focus();
  });

  $('bookingForm').addEventListener('submit', createBooking);
  $('payButton').addEventListener('click', pay);
  $('manageForm').addEventListener('submit', lookupBooking);

  $('homeButton').addEventListener('click', () => showView('searchView'));
  $('searchNav').addEventListener('click', () => showView('searchView'));
  $('manageNav').addEventListener('click', () => showView('manageView'));
  $('backToResults').addEventListener('click', () => showView('searchView'));
  $('backToPassenger').addEventListener('click', () => showView('checkoutView'));
  $('newSearchButton').addEventListener('click', () => {
    state.selectedJourney = null;
    state.bookingSession = null;
    state.booking = null;
    showView('searchView');
    window.scrollTo({ top: 0 });
  });
  $('manageThisBooking').addEventListener('click', () => {
    showView('manageView');
    if ($('manageReference').value && $('manageEmail').value) lookupBooking();
  });
}

function init() {
  setBrand();
  setDefaultDate();
  $('originInput').value = 'Warsaw';
  $('destinationInput').value = 'Kyiv';
  wireEvents();
}

init();

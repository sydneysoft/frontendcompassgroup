import { api } from './api.js';

const app = document.querySelector('#app');
const cfg = window.BUS_APP_CONFIG || { brandName:'Wayline', defaultCurrency:'EUR' };

const state = {
  view: 'home',
  search: { origin:'Warsaw', destination:'Kyiv', departureDate:nextDate(1), returnDate:'', adults:1, children:0, currency:cfg.defaultCurrency || 'EUR' },
  searchId:null,
  journeys:[],
  selectedJourney:null,
  bookingSession:null,
  booking:null,
  payment:null,
  paymentMethod:'apple_pay',
  loading:false,
  error:null,
  filters:{ direct:false, wifi:false, refundable:false },
  sort:'recommended',
  drawer:null
};

function nextDate(offset){ const d=new Date(); d.setDate(d.getDate()+offset); return d.toISOString().slice(0,10); }
function money(amount,currency){ try{return new Intl.NumberFormat(undefined,{style:'currency',currency}).format(Number(amount));}catch{return `${amount} ${currency}`;} }
function dateLabel(value){ return new Intl.DateTimeFormat(undefined,{weekday:'short',day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`)); }
function timeLabel(value){ return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)); }
function minutesLabel(min){ const h=Math.floor(min/60),m=min%60; return `${h}h ${m}m`; }
function escapeHtml(value=''){ return String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch])); }
function uid(){ return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function toast(msg){ const el=document.querySelector('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2600); }

function header(){
  return `<header class="topbar"><div class="container nav">
    <a class="brand" href="#home" data-nav="home"><span class="brand-mark">W</span><span>${escapeHtml(cfg.brandName || 'Wayline')}</span></a>
    <div class="nav-actions">
      <button class="nav-btn hide-mobile" data-nav="manage">Manage booking</button>
      <button class="nav-btn hide-mobile">EN · ${escapeHtml(state.search.currency)}</button>
      <button class="nav-btn" aria-label="Menu">☰</button>
    </div>
  </div></header>`;
}

function footer(){ return `<footer class="footer"><div class="container footer-grid"><div><div class="brand"><span class="brand-mark">W</span><span>${escapeHtml(cfg.brandName || 'Wayline')}</span></div><p>Independent ground-transport booking platform. Live journey inventory will be supplied through the configured transport API.</p></div><div><h4>Bookings</h4><a href="#home" data-nav="home">Search trips</a><a href="#manage" data-nav="manage">Manage booking</a><a href="#">Help center</a></div><div><h4>Company</h4><a href="#">Terms</a><a href="#">Privacy</a><a href="#">Contact</a></div></div></footer>`; }

function homeView(){
  const popular=[['Warsaw','Kyiv','€27'],['Lviv','Kraków','€19'],['Prague','Kyiv','€38'],['Berlin','Warsaw','€24']];
  return `${header()}<main>
  <section class="hero"><div class="container"><div class="hero-copy"><div class="eyebrow">Ground travel, simplified</div><h1>Find your next bus in a few taps.</h1><p>Compare departures, choose a journey, pay securely and keep your ticket in one place.</p></div>${searchForm()}</div></section>
  <section class="section"><div class="container"><h2>Popular routes</h2><div class="route-grid">${popular.map(r=>`<button class="route-card" data-route="${r[0]}|${r[1]}"><div class="route-route">${r[0]} → ${r[1]}</div><div class="route-meta">Direct & connecting departures</div><div class="route-price"><small>from </small>${r[2]}</div></button>`).join('')}</div></div></section>
  <section class="section" style="padding-top:0"><div class="container"><div class="value-strip"><article class="value-card"><div class="value-icon">⌕</div><h3>Compare in one search</h3><p>Trips are loaded through the transport provider API and normalized into one simple result list.</p></article><article class="value-card"><div class="value-icon">✓</div><h3>Rechecked before payment</h3><p>Availability and price are reconfirmed when you choose a journey, reducing stale booking failures.</p></article><article class="value-card"><div class="value-icon">◉</div><h3>Flexible checkout</h3><p>Visa, Mastercard, Apple Pay, Google Pay and PayPal are exposed as separate checkout options.</p></article></div></div></section>
  </main>${footer()}`;
}

function searchForm(){ return `<form id="search-form" class="search-shell" autocomplete="off">
    ${locationField('origin','From',state.search.origin)}
    <button class="swap" type="button" id="swap" aria-label="Swap origin and destination">⇄</button>
    ${locationField('destination','To',state.search.destination)}
    <div class="field date-field"><label for="departureDate">Departure</label><input id="departureDate" name="departureDate" type="date" min="${nextDate(0)}" value="${state.search.departureDate}" required></div>
    <div class="field return-field"><label for="returnDate">Return (optional)</label><input id="returnDate" name="returnDate" type="date" min="${state.search.departureDate}" value="${state.search.returnDate}"></div>
    <div class="field passengers-field"><label for="adults">Passengers</label><select id="adults" name="adults">${[1,2,3,4,5,6,7,8,9].map(n=>`<option value="${n}" ${n===state.search.adults?'selected':''}>${n} adult${n>1?'s':''}</option>`).join('')}</select></div>
    <button class="search-submit" type="submit">Search</button>
  </form>`; }
function locationField(name,label,value){return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" value="${escapeHtml(value)}" placeholder="City" required><div class="autocomplete" id="${name}-suggestions" hidden></div></div>`;}

function resultsView(){
  const filtered = sortedJourneys();
  return `${header()}<div class="results-head"><div class="container route-summary"><div><h1>${escapeHtml(state.search.origin)} → ${escapeHtml(state.search.destination)}</h1><p>${dateLabel(state.search.departureDate)} · ${state.search.adults} adult${state.search.adults>1?'s':''}</p></div><button class="secondary" data-nav="home">Edit search</button></div></div>
  <div class="date-row"><div class="container date-scroller">${[-2,-1,0,1,2].map(o=>dateChip(o)).join('')}</div></div>
  <main class="container results-layout"><aside class="filters">${filtersMarkup()}</aside><section><div class="results-toolbar"><div class="results-count">${filtered.length} journey${filtered.length!==1?'s':''}</div><div><button class="secondary mobile-filter" id="mobile-filter-btn">Filters</button> <select class="sort-select" id="sort"><option value="recommended" ${state.sort==='recommended'?'selected':''}>Recommended</option><option value="cheapest" ${state.sort==='cheapest'?'selected':''}>Cheapest</option><option value="earliest" ${state.sort==='earliest'?'selected':''}>Earliest departure</option><option value="shortest" ${state.sort==='shortest'?'selected':''}>Shortest journey</option></select></div></div>
  ${state.loading?loadingMarkup('Searching available departures…'):state.error?errorMarkup():filtered.length?`<div class="trip-list">${filtered.map(tripCard).join('')}</div>`:emptyMarkup()}
  </section></main>${footer()}${state.drawer?drawerMarkup():''}`;
}
function dateChip(offset){ const d=new Date(`${state.search.departureDate}T12:00:00`); d.setDate(d.getDate()+offset); const iso=d.toISOString().slice(0,10); const active=offset===0; const pseudo=state.journeys.length?Math.min(...state.journeys.map(j=>Number(j.price)))+Math.abs(offset)*1.2:null; return `<button class="date-chip ${active?'active':''}" data-date="${iso}"><span class="day">${new Intl.DateTimeFormat(undefined,{weekday:'short'}).format(d)}</span><div class="date">${new Intl.DateTimeFormat(undefined,{day:'numeric',month:'short'}).format(d)}</div><span class="price">${pseudo?money(pseudo,state.search.currency):'Search'}</span></button>`; }
function filtersMarkup(){return `<h3>Filters</h3><div class="filter-block"><div class="filter-title">Journey</div><label class="check"><input id="f-direct" type="checkbox" ${state.filters.direct?'checked':''}> Direct only</label><label class="check"><input id="f-wifi" type="checkbox" ${state.filters.wifi?'checked':''}> Wi‑Fi</label><label class="check"><input id="f-refundable" type="checkbox" ${state.filters.refundable?'checked':''}> Refundable</label></div><div class="filter-block"><div class="filter-title">Payment methods</div><div class="detail-copy">Visa · Mastercard<br>Apple Pay · Google Pay<br>PayPal</div></div>`; }
function sortedJourneys(){ let list=[...state.journeys]; if(state.filters.direct)list=list.filter(j=>j.transfers===0); if(state.filters.wifi)list=list.filter(j=>j.amenities?.includes('wifi')); if(state.filters.refundable)list=list.filter(j=>j.refundable); if(state.sort==='cheapest')list.sort((a,b)=>Number(a.price)-Number(b.price)); if(state.sort==='earliest')list.sort((a,b)=>new Date(a.departure_at)-new Date(b.departure_at)); if(state.sort==='shortest')list.sort((a,b)=>a.duration_minutes-b.duration_minutes); return list; }
function tripCard(j){ const seats=j.available_seats!=null?`${j.available_seats} seats left`:''; return `<article class="trip-card"><div class="trip-top"><div class="operator"><span class="operator-logo">${escapeHtml(j.operator_name.slice(0,2).toUpperCase())}</span>${escapeHtml(j.operator_name)}</div>${j.refundable?'<span class="badge">Refundable</span>':'<span class="badge">Live fare</span>'}</div><div class="trip-main"><div><div class="time">${timeLabel(j.departure_at)}</div><div class="station">${escapeHtml(j.origin_station)}</div></div><div class="duration">${minutesLabel(j.duration_minutes)}<div class="duration-line"></div>${j.transfers===0?'Direct':`${j.transfers} transfer${j.transfers>1?'s':''}`}</div><div><div class="time">${timeLabel(j.arrival_at)}</div><div class="station">${escapeHtml(j.destination_station)}</div></div><div class="price-box"><div class="price">${money(j.price,j.currency)}</div><div class="seats">${escapeHtml(seats)}</div></div></div><div class="trip-foot"><div class="amenities">${(j.amenities||[]).slice(0,3).map(a=>`<span class="amenity">${amenityLabel(a)}</span>`).join('')}</div><div class="trip-actions"><button class="secondary" data-details="${j.id}">Details</button><button class="primary" data-select="${j.id}">Select</button></div></div></article>`; }
function amenityLabel(a){return ({wifi:'Wi‑Fi',power:'Power',air_conditioning:'A/C',toilet:'Toilet'}[a]||a.replaceAll('_',' '));}
function drawerMarkup(){ const j=state.drawer; return `<div class="drawer-backdrop" id="drawer-backdrop"><div class="drawer" role="dialog" aria-modal="true"><div class="drawer-head"><h2>Journey details</h2><button class="close-btn" id="close-drawer">×</button></div><div class="detail-stop"><div class="detail-title">${escapeHtml(j.operator_name)}</div><div class="detail-copy">Provider: ${escapeHtml(j.provider)} · ${j.transfers===0?'Direct journey':`${j.transfers} transfer(s)`}</div></div><div class="detail-stop"><div class="detail-title">Departure</div><div class="detail-copy">${dateLabel(j.departure_at.slice(0,10))}, ${timeLabel(j.departure_at)}<br>${escapeHtml(j.origin_station)}</div></div><div class="detail-stop"><div class="detail-title">Arrival</div><div class="detail-copy">${dateLabel(j.arrival_at.slice(0,10))}, ${timeLabel(j.arrival_at)}<br>${escapeHtml(j.destination_station)}</div></div><div class="detail-stop"><div class="detail-title">On board</div><div class="amenities">${(j.amenities||[]).map(a=>`<span class="amenity">${amenityLabel(a)}</span>`).join('')||'<span class="detail-copy">No amenity information provided.</span>'}</div></div><div class="detail-stop"><div class="detail-title">Fare</div><div class="detail-copy">${money(j.price,j.currency)} · ${j.refundable?'Refundable according to provider rules':'Refundability not included in provider response'}</div></div><button class="primary" style="width:100%;margin-top:16px" data-select="${j.id}">Choose this journey</button></div></div>`; }
function loadingMarkup(text){return `<div class="loading"><div class="spinner"></div>${escapeHtml(text)}</div>`;}
function errorMarkup(){return `<div class="empty"><h3>We couldn't load journeys</h3><p>${escapeHtml(state.error||'Please try again.')}</p><button class="primary" id="retry-search">Try again</button></div>`;}
function emptyMarkup(){return `<div class="empty"><h3>No journeys found</h3><p>Try a different date or route.</p><button class="secondary" data-nav="home">Change search</button></div>`;}

function checkoutView(){ const j=state.selectedJourney,s=state.bookingSession; if(!j||!s)return homeView(); const methods=[['visa','Visa','Card'],['mastercard','Mastercard','Card'],['apple_pay','Apple Pay','Wallet'],['google_pay','Google Pay','Wallet'],['paypal','PayPal','Wallet']]; return `${header()}<main class="checkout-page"><div class="container checkout-grid"><section><div class="panel"><h2>Passenger information</h2><form id="checkout-form"><div class="form-grid"><div class="form-field"><label>First name</label><input name="first_name" required autocomplete="given-name"></div><div class="form-field"><label>Last name</label><input name="last_name" required autocomplete="family-name"></div><div class="form-field"><label>Date of birth</label><input name="date_of_birth" type="date"></div><div class="form-field"><label>Nationality (2–3 letters)</label><input name="nationality" maxlength="3" placeholder="PE"></div></div></div><div class="panel"><h2>Contact details</h2><div class="form-grid"><div class="form-field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div><div class="form-field"><label>Phone</label><input name="phone" required minlength="6" autocomplete="tel" placeholder="+44 ..."></div></div></div><div class="panel"><h2>Payment</h2><div class="payment-grid">${methods.map(m=>`<button type="button" class="payment-option ${state.paymentMethod===m[0]?'selected':''}" data-payment-method="${m[0]}">${m[1]}<span class="sub">${m[2]}</span></button>`).join('')}</div><div class="paybar"><button class="primary" type="submit" ${state.loading?'disabled':''}>${state.loading?'Processing…':`Pay ${money(s.amount,s.currency)}`}</button><div class="fineprint">Development mode uses the backend sandbox payment gateway. Production credentials are required before real money can be charged.</div></div></form></div></section><aside><div class="summary-card"><h3>Your journey</h3><div class="summary-route">${escapeHtml(j.origin_name)} → ${escapeHtml(j.destination_name)}</div><div class="summary-row"><span>${dateLabel(j.departure_at.slice(0,10))}</span><b>${timeLabel(j.departure_at)} → ${timeLabel(j.arrival_at)}</b></div><div class="summary-row"><span>Operator</span><b>${escapeHtml(j.operator_name)}</b></div><div class="summary-row"><span>Duration</span><b>${minutesLabel(j.duration_minutes)}</b></div><div class="summary-total"><span>Total</span><span>${money(s.amount,s.currency)}</span></div></div></aside></div></main>${footer()}`; }

function confirmationView(){ const b=state.booking; if(!b)return homeView(); const ticket=b.tickets?.[0]; return `${header()}<main class="confirm-wrap"><div class="confirm-card"><div class="checkmark">✓</div><h1>Booking confirmed</h1><p>Your booking has been ticketed successfully.</p><div class="reference">${escapeHtml(b.reference)}</div><div class="ticket-box"><div class="ticket-row"><span>Status</span><b>${escapeHtml(b.status)}</b></div><div class="ticket-row"><span>Amount</span><b>${money(b.amount,b.currency)}</b></div><div class="ticket-row"><span>Email</span><b>${escapeHtml(b.contact_email)}</b></div>${ticket?`<div class="ticket-row"><span>Ticket</span><b>${escapeHtml(ticket.ticket_number||'Issued')}</b></div><div class="ticket-row"><span>QR payload</span><b>${escapeHtml(ticket.qr_text||'Available')}</b></div>`:''}</div><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="primary" data-nav="manage">Manage booking</button><button class="secondary" data-nav="home">Book another trip</button></div></div></main>`; }

function manageView(){return `${header()}<main class="manage-wrap"><div class="container"><section class="manage-card"><h1>Manage booking</h1><p>Enter the booking reference and the same email used at checkout.</p><form id="lookup-form"><div class="form-grid"><div class="form-field span-2"><label>Booking reference</label><input name="reference" required placeholder="BTXXXXXXXXXX"></div><div class="form-field span-2"><label>Email</label><input name="email" type="email" required></div><button class="primary span-2" type="submit">Find booking</button></div></form>${state.booking?lookupResult(state.booking):''}</section></div></main>${footer()}`;}
function lookupResult(b){return `<div class="lookup-result"><div class="summary-row"><span>Reference</span><b>${escapeHtml(b.reference)}</b></div><div class="summary-row"><span>Status</span><b>${escapeHtml(b.status)}</b></div><div class="summary-row"><span>Total</span><b>${money(b.amount,b.currency)}</b></div>${b.tickets?.length?`<div class="summary-row"><span>Ticket</span><b>${escapeHtml(b.tickets[0].ticket_number||'Issued')}</b></div>`:''}${['ticketed','confirmed'].includes(b.status)?'<button class="secondary" id="cancel-booking" style="width:100%;margin-top:12px">Cancel / refund booking</button>':''}</div>`;}

function render(){ if(state.view==='home')app.innerHTML=homeView(); else if(state.view==='results')app.innerHTML=resultsView(); else if(state.view==='checkout')app.innerHTML=checkoutView(); else if(state.view==='confirmation')app.innerHTML=confirmationView(); else if(state.view==='manage')app.innerHTML=manageView(); bind(); window.scrollTo({top:0,behavior:'instant'}); }

function bind(){
  document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault(); navigate(el.dataset.nav);}));
  document.querySelectorAll('[data-route]').forEach(el=>el.addEventListener('click',()=>{const[o,d]=el.dataset.route.split('|');state.search.origin=o;state.search.destination=d;startSearch();}));
  const form=document.querySelector('#search-form'); if(form){
    form.addEventListener('submit',e=>{e.preventDefault(); const fd=new FormData(form);state.search.origin=fd.get('origin').trim();state.search.destination=fd.get('destination').trim();state.search.departureDate=fd.get('departureDate');state.search.returnDate=fd.get('returnDate');state.search.adults=Number(fd.get('adults'));startSearch();});
    document.querySelector('#swap')?.addEventListener('click',()=>{[state.search.origin,state.search.destination]=[document.querySelector('#destination').value,document.querySelector('#origin').value];render();});
    setupAutocomplete('origin');setupAutocomplete('destination');
  }
  document.querySelectorAll('[data-date]').forEach(el=>el.addEventListener('click',()=>{state.search.departureDate=el.dataset.date;startSearch();}));
  document.querySelector('#sort')?.addEventListener('change',e=>{state.sort=e.target.value;render();});
  [['#f-direct','direct'],['#f-wifi','wifi'],['#f-refundable','refundable']].forEach(([sel,key])=>document.querySelector(sel)?.addEventListener('change',e=>{state.filters[key]=e.target.checked;render();}));
  document.querySelectorAll('[data-details]').forEach(el=>el.addEventListener('click',()=>{state.drawer=state.journeys.find(j=>j.id===el.dataset.details);render();}));
  document.querySelector('#close-drawer')?.addEventListener('click',()=>{state.drawer=null;render();});
  document.querySelector('#drawer-backdrop')?.addEventListener('click',e=>{if(e.target.id==='drawer-backdrop'){state.drawer=null;render();}});
  document.querySelectorAll('[data-select]').forEach(el=>el.addEventListener('click',()=>selectJourney(el.dataset.select)));
  document.querySelector('#retry-search')?.addEventListener('click',startSearch);
  document.querySelectorAll('[data-payment-method]').forEach(el=>el.addEventListener('click',()=>{state.paymentMethod=el.dataset.paymentMethod;render();}));
  document.querySelector('#checkout-form')?.addEventListener('submit',submitCheckout);
  document.querySelector('#lookup-form')?.addEventListener('submit',lookupBooking);
  document.querySelector('#cancel-booking')?.addEventListener('click',cancelBooking);
}

function navigate(view){ state.view=view; if(view==='home'){state.booking=null;} render(); }
async function setupAutocomplete(name){ const input=document.querySelector(`#${name}`),box=document.querySelector(`#${name}-suggestions`); if(!input||!box)return; let timer; input.addEventListener('input',()=>{clearTimeout(timer); const q=input.value.trim(); if(q.length<2){box.hidden=true;return;} timer=setTimeout(async()=>{try{const data=await api.locations(q); if(!data.items?.length){box.hidden=true;return;} box.innerHTML=data.items.map(i=>`<div class="suggestion" data-value="${escapeHtml(i.name)}"><b>${escapeHtml(i.name)}</b><span>${escapeHtml(i.country||'')}</span></div>`).join(''); box.hidden=false; box.querySelectorAll('.suggestion').forEach(s=>s.addEventListener('click',()=>{input.value=s.dataset.value;box.hidden=true;}));}catch{box.hidden=true;}},180);}); input.addEventListener('blur',()=>setTimeout(()=>box.hidden=true,160)); }
async function startSearch(){ state.view='results';state.loading=true;state.error=null;state.journeys=[];state.drawer=null;render(); try{const out=await api.search({origin:state.search.origin,destination:state.search.destination,departure_date:state.search.departureDate,return_date:state.search.returnDate||null,passengers:{adults:state.search.adults,children:state.search.children||0},currency:state.search.currency});state.searchId=out.search_id;state.journeys=out.journeys||[];}catch(e){state.error=e.message;}finally{state.loading=false;render();} }
async function selectJourney(id){ const j=state.journeys.find(x=>x.id===id); if(!j)return; state.selectedJourney=j;state.drawer=null;state.loading=true;render();try{const s=await api.createSession(j.id);state.bookingSession=s;if(s.price_changed)toast(`Fare updated to ${money(s.amount,s.currency)}`);state.view='checkout';}catch(e){state.error=e.message;toast(e.message);state.view='results';}finally{state.loading=false;render();} }
async function submitCheckout(e){ e.preventDefault(); if(state.loading)return; const fd=new FormData(e.currentTarget);state.loading=true;render();try{const passenger={first_name:fd.get('first_name'),last_name:fd.get('last_name'),passenger_type:'adult',date_of_birth:fd.get('date_of_birth')||null,nationality:(fd.get('nationality')||'').trim().toUpperCase()||null,document_type:null,document_number:null};let booking=await api.createBooking({booking_session_id:state.bookingSession.id,contact_email:fd.get('email'),contact_phone:fd.get('phone'),passengers:[passenger]});state.booking=booking;const payment=await api.createPayment({booking_id:booking.id,method:state.paymentMethod,idempotency_key:uid(),return_url:location.href});state.payment=payment;if(payment.action?.url){location.href=payment.action.url;return;}const paid=await api.devSucceed(payment.id);if(paid.status!=='paid')throw new Error('Payment was not completed');booking=await api.getBooking(booking.reference,booking.contact_email);state.booking=booking;state.view='confirmation';}catch(err){toast(err.message);state.error=err.message;}finally{state.loading=false;render();} }
async function lookupBooking(e){e.preventDefault();const fd=new FormData(e.currentTarget);try{state.booking=await api.getBooking(fd.get('reference').trim().toUpperCase(),fd.get('email').trim());render();}catch(err){state.booking=null;toast(err.message);} }
async function cancelBooking(){if(!state.booking)return;if(!confirm('Request cancellation and refund for this booking?'))return;try{state.booking=await api.cancelBooking(state.booking.reference,state.booking.contact_email);toast(`Booking ${state.booking.status}`);render();}catch(err){toast(err.message);} }

window.addEventListener('hashchange',()=>{const v=location.hash.replace('#','');if(['home','manage'].includes(v)){state.view=v;render();}});
render();

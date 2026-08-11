# Wayline web frontend

A mobile-first customer booking UI wired to the FastAPI backend in `../api`.

## Implemented customer flow

- Home page and responsive navigation
- Origin/destination autocomplete from `GET /api/v1/locations`
- Departure/return date inputs and passenger count
- Live journey search via `POST /api/v1/searches`
- Search results, date switching, sorting and filters
- Journey details drawer
- Repricing/availability check via `POST /api/v1/booking-sessions`
- Passenger/contact checkout
- Payment selection: Visa, Mastercard, Apple Pay, Google Pay, PayPal
- Sandbox payment completion during development
- Booking confirmation and ticket details
- Manage-booking lookup
- Cancellation/refund request

## Run locally

Start the API first, then serve this directory on port 5173:

```bash
http-server . -p 5173 -c-1
```

Open `http://localhost:5173`.

`config.js` controls the backend URL and brand name.

## Production note

The frontend currently calls the backend sandbox completion endpoint after a payment intent is created. In production, that code path must be replaced by each real payment provider's browser SDK / redirect flow and webhook-confirmed payment state.

# Bus Booking Frontend

This is the clean customer frontend for the bus-booking project. It contains only the bus-ticket application files and branding.

It is intentionally dependency-free. Since Node/npm is already installed on the Mac, `npm run dev` starts the included Node development server without running `npm install`.

## Backend expected

The frontend expects the FastAPI backend at:

```text
http://127.0.0.1:8000/api/v1
```

You can change that in `config.js`.

## Run the backend

In terminal 1:

```bash
cd /Users/julioquesada/compassgroup/compassgroup/backendcompassgroup
source .venv/bin/activate
python3 -m uvicorn app.main:app --reload
```

Check:

```text
http://127.0.0.1:8000/docs
```

## Run this frontend

In terminal 2, enter the folder where you extracted this frontend and run:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

No `npm install` is required because this frontend has no external npm dependencies.

## Implemented flow

- From / To search
- API location autocomplete
- Departure date
- Adults / children
- Currency
- API trip search
- Date switching
- Sorting and filters
- Journey selection
- Backend availability/repricing check
- Passenger forms
- Contact details
- Booking creation
- Visa
- Mastercard
- Apple Pay
- Google Pay
- PayPal
- Sandbox payment success
- Booking confirmation
- Test ticket / QR data
- Manage booking lookup
- Cancellation/refund flow

## Important

Payments are currently the backend's development sandbox. No real money is charged until production payment credentials are integrated.

Trips come from the backend provider. With the current backend configuration they come from the mock provider. When the Distribusion adapter is configured with approved retailer credentials, the frontend does not need to be redesigned; it continues calling the same backend endpoints.

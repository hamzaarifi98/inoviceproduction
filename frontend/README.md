# Invoice Pocket Frontend

Mobile-first invoice app for logging in, uploading invoices, extracting invoice data, and reviewing spending categories.

## Run

Start the backend on `http://localhost:8000`, then serve this folder on port `3000`:

```bash
python3 -m http.server 3000
```

Open `http://localhost:3000`.

If port `3000` is busy, use `3001`:

```bash
python3 -m http.server 3001
```

The app stores the auth token and invoice dashboard history in `localStorage`.

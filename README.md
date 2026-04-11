# SPY GLASS HOUSE - MySQL Stack

This project now uses MySQL + Node.js API + Firebase customer login.

## Stack

- Frontend: `index.html`, `owner-portal-sgh-7842.html`, `assets/`
- Backend API: `server/`
- Database: MySQL schema `spy_glass_house`

## Setup

1. Install dependencies:

```powershell
cd "C:\Users\PREET\Documents\PERSONAL PROJECT"
npm install
```

2. Create `.env`:

```powershell
Copy-Item ".env.example" ".env"
```

3. Update `.env` values:
- `DB_USER`
- `DB_PASSWORD`
- `ADMIN_LOGIN_EMAIL`
- `ADMIN_LOGIN_PASSWORD`
- `FIREBASE_WEB_API_KEY` (from Firebase project settings)
- `JWT_SECRET`

4. Start API:

```powershell
npm start
```

API default: `http://127.0.0.1:8080`

5. Update frontend config file:
- `assets/app-config.js`
- `window.SPYGLASS_API_BASE = "http://127.0.0.1:8080";`

## Admin Login

- Open your private admin URL: `owner-portal-sgh-7842.html`
- Use `ADMIN_LOGIN_EMAIL` and `ADMIN_LOGIN_PASSWORD` from `.env`

## Customer Login

- Customer must login with Google before placing any order.
- Firebase Google provider must be enabled in Firebase Authentication.
- Add your domain (`127.0.0.1`, `localhost`, and live domain) in Firebase Authorized Domains.

## Important

If you want public live access for everyone, local MySQL on your laptop is not enough.  
Host backend + MySQL on cloud, then set `SPYGLASS_API_BASE` to your live API URL.

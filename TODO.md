# SPY GLASS HOUSE Admin Panel Live Deployment Plan

## Status
- [x] Frontend deployed: https://spy-glass-house.web.app/owner-portal-sgh-7842.html
- [ ] Backend API deployed to cloud
- [ ] MySQL hosted (PlanetScale/Railway)
- [ ] Update app-config.js with live API URL
- [ ] Test admin login live

## Step 1: Deploy Backend + MySQL (Railway recommended)
```
1. Push code to GitHub
2. Connect Railway, deploy server/
3. Add MySQL plugin, run schema migrations
4. Get live API URL (e.g. https://spyglass-123.railway.app)
```

## Step 2: Update Config
```
Edit assets/app-config.js:
window.SPYGLASS_API_BASE = "https://spyglass-123.railway.app";
firebase deploy --only hosting
```

## Step 3: Test
```
Live admin: https://spy-glass-house.web.app/owner-portal-sgh-7842.html
Login: mmpptt9@gmail.com + .env password
```

**Ready to proceed with Step 1? Confirm to create Railway deployment files.**

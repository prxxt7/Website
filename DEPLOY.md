# Deploy SPY GLASS HOUSE to Render + PlanetScale

## Step 1: Push to GitHub

1. Create a new repository on GitHub (e.g., `spy-glass-house`)
2. Push your code:

```bash
git remote add origin https://github.com/YOUR_USERNAME/spy-glass-house.git
git add .
git commit -m "Prepare for Render deployment"
git push -u origin master
```

**Important:** Make sure `.env` is in `.gitignore` - never commit secrets!

## Step 2: Create PlanetScale Database

1. Go to https://planetscale.com and sign up (free)
2. Click **Create database**
3. Name: `spy-glass-house`
4. Region: Choose closest to your users
5. Click **Create**

### Get Connection String

1. In database dashboard, click **Connect**
2. Select **Node.js** → **mysql2**
3. Copy the connection string - you'll need these values:
   - Host (e.g., `aws.connect.psdb.cloud`)
   - Port: `3306`
   - Username
   - Password (click **Create password** if none exists)

## Step 3: Create Database Schema

In PlanetScale console, go to **Console** tab and run:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_uid VARCHAR(128),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(30),
  role VARCHAR(20) DEFAULT 'customer',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(200) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(120) NOT NULL,
  type_key VARCHAR(80) NOT NULL,
  badge VARCHAR(80) DEFAULT '',
  description TEXT,
  image_url VARCHAR(2000),
  price_inr DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT UNSIGNED,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(20) NOT NULL UNIQUE,
  user_id INT UNSIGNED,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(190) NOT NULL,
  customer_phone VARCHAR(30) NOT NULL,
  city VARCHAR(100) NOT NULL,
  pincode VARCHAR(20) NOT NULL,
  address_line TEXT NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  payment_status VARCHAR(40) DEFAULT 'pending',
  order_status VARCHAR(40) DEFAULT 'new',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED,
  product_name VARCHAR(180) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  line_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS visits (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(120),
  user_id INT UNSIGNED,
  event_type VARCHAR(60) DEFAULT 'page_view',
  page_path VARCHAR(255),
  referrer VARCHAR(500),
  user_agent VARCHAR(512),
  ip_address VARCHAR(64),
  country VARCHAR(100),
  city VARCHAR(100),
  device_type VARCHAR(40),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS enquiries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190),
  phone VARCHAR(30) NOT NULL,
  city VARCHAR(100),
  need VARCHAR(120),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

## Step 4: Deploy to Render

1. Go to https://render.com and sign up (free)
2. Click **New +** → **Web Service**
3. Connect your GitHub account
4. Select your `spy-glass-house` repository
5. Configure:
   - **Name**: `spy-glass-house`
   - **Region**: Choose closest to users
   - **Branch**: `master`
   - **Root Directory**: (leave blank)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**

6. Click **Advanced** and add these environment variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `8080` |
| `DB_HOST` | (from PlanetScale connection) |
| `DB_PORT` | `3306` |
| `DB_USER` | (from PlanetScale connection) |
| `DB_PASSWORD` | (from PlanetScale password) |
| `DB_NAME` | `spy_glass_house` |
| `DB_SSL` | `true` |
| `ADMIN_EMAILS` | `mmpptt9@gmail.com` |
| `ADMIN_LOGIN_EMAIL` | `mmpptt9@gmail.com` |
| `ADMIN_LOGIN_PASSWORD` | (your admin password) |
| `FIREBASE_WEB_API_KEY` | (your Firebase key) |
| `JWT_SECRET` | (generate a random long string) |
| `CORS_ORIGIN` | `https://spy-glass-house.web.app,https://spy-glass-house.firebaseapp.com` |

7. Click **Create Web Service**

Render will build and deploy (~2-5 minutes).

## Step 5: Verify Deployment

1. Once deployed, note your URL: `https://spy-glass-house-xxxx.onrender.com`
2. Test health endpoint: `https://your-app.onrender.com/api/health`
3. Update your frontend's API URL to point to the new backend

## Important Notes

- **First request after 15 min idle will be slow** (~30s) - Render free tier sleeps
- **Check logs** in Render dashboard for any errors
- **Update CORS_ORIGIN** if you deploy frontend to a new domain

## Troubleshooting

### Database connection fails
- Verify PlanetScale credentials in Render env vars
- Ensure `DB_SSL=true` is set
- Check PlanetScale console for connection limits

### CORS errors
- Add your frontend URL to `CORS_ORIGIN` env var (comma-separated)

### 500 errors
- Check Render logs for detailed error messages
- Verify all required env vars are set

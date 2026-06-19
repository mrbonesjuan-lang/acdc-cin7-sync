# ACDC Express — Cin7 Sync Service

This little program is the "bridge" between your Cin7 Omni store and Metabase.
It checks Cin7 every 15 minutes, copies your sales and stock data into a
database, and that's the database Metabase will draw your dashboard from.

**Why not real webhooks?** Cin7 Omni doesn't let you register your own
webhook for "new sale" or "stock changed" events — that feature only exists
for specific built-in integrations (Mailchimp, Stripe, etc). So instead this
service checks in regularly on a timer. From your side it behaves the same
way: turn it on once, never touch it again, dashboard stays fresh.

---

## What you're setting up (big picture)

```
Cin7 Omni  →  This sync service (checks every 15 min)  →  PostgreSQL database  →  Metabase dashboard
```

You will create **3 things**, all free for a single store:

1. A **PostgreSQL database** (where the data lives)
2. **This sync service** (the thing that fetches the data)
3. **Metabase** (the thing that draws your charts)

---

## Step 1 — Create the free database

1. Go to [render.com](https://render.com) and sign up (free, no credit card needed for this part)
2. Click **New +** → **PostgreSQL**
3. Give it a name like `acdc-data`
4. Choose the **Free** plan
5. Click **Create Database**
6. Once it's ready, find **Internal Database URL** on the database page — copy it. You'll need it in Step 2.

---

## Step 2 — Deploy this sync service

1. Create a free [GitHub](https://github.com) account if you don't have one
2. Create a new repository (e.g. `acdc-cin7-sync`) and upload everything in this folder to it
   - Easiest way: on github.com, click **Add file → Upload files** and drag the whole folder in
3. Go back to [render.com](https://render.com) → **New +** → **Web Service**
4. Connect your GitHub repo
5. Render will auto-detect Node.js. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Under **Environment Variables**, add these (click "Add Environment Variable" for each):

   | Key | Value |
   |---|---|
   | `CIN7_API_USER` | `Juan Test API` |
   | `CIN7_API_KEY` | `14b200c01185420b87d731d72575c898` |
   | `DATABASE_URL` | *(paste the Internal Database URL from Step 1)* |
   | `SYNC_INTERVAL_MINUTES` | `15` |

7. Click **Create Web Service**

Render will build and start it. Give it 2-3 minutes. Once it says **Live**,
click the URL it gives you (something like `acdc-cin7-sync.onrender.com`) —
you should see: *"Cin7 sync service is running."*

To check it's actually pulling data, visit `your-url.onrender.com/status`
— you'll see a log of each sync attempt and how many orders/products it found.

**Note:** Free Render web services "sleep" after 15 minutes with no traffic
and wake up on the next request — this can briefly pause your sync schedule.
If that matters to you, Render's cheapest **paid** tier ($7/month) stays
always-on. For one store, the free tier is usually fine since you can also
visit `/sync-now` any time to force an immediate update.

---

## Step 3 — Connect Metabase

1. Go to [metabase.com](https://www.metabase.com/start/) and either:
   - Use **Metabase Cloud** (free 14-day trial, then paid), or
   - Self-host the free open-source version (more setup, but free forever)
2. In Metabase: **Settings (gear icon) → Admin Settings → Databases → Add a database**
3. Choose **PostgreSQL**
4. Use the **External Database URL** from your Render PostgreSQL page (Step 1) to fill in:
   - Host, Port, Database name, Username, Password
   (Render shows these broken out individually right below the connection URL)
5. Click **Save**

Metabase will scan the database and find your tables: `sales_orders`,
`sales_order_lines`, `products`, and `sync_log`.

---

## Step 4 — Build the dashboard in Metabase to match your ACDC design

Once connected, in Metabase:

1. Click **+ New → Dashboard**, name it "ACDC Express Insights"
2. Click **+ New → Question** for each chart you want, e.g.:
   - **Revenue over time:** Table = `sales_orders`, Summarize = Sum of `total`, Group by = `order_date` (by week)
   - **Top products:** Table = `sales_order_lines`, Summarize = Sum of `line_total`, Group by = `product_name`, sort descending, limit 10
   - **Revenue by category:** Table = `sales_order_lines`, Summarize = Sum of `line_total`, Group by = `category`
   - **Stock levels:** Table = `products`, just a plain table view sorted by `stock_available` ascending to surface low-stock items first
3. Save each question, then add them all to your "ACDC Express Insights" dashboard
4. Use Metabase's dashboard editor to resize/arrange tiles, and change the color theme under **Settings → Appearance** to match your orange/dark ACDC branding

This part is genuinely the fun bit — Metabase's chart editor is visual, so
you can drag fields around and see results instantly without writing SQL.

---

## Keeping it running

Once all 3 pieces are live, you're done. The sync service checks Cin7 every
15 minutes automatically, forever, with no further action from you. If you
ever want to change how far back it looks or how often it runs, edit the
`SYNC_INTERVAL_MINUTES` environment variable in Render and it restarts itself.

## If something looks wrong

Visit `your-render-url.onrender.com/status` first — it shows the last 10
sync attempts and any error messages. Most issues are either:
- Wrong API credentials (double check username/key in Render's environment variables)
- Database connection string typo (re-copy the Internal Database URL)

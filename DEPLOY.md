# Deploy PixelConnect to Render

## Prerequisites
- A GitHub account with this repo pushed (`henryparker37-vip/pixel_connect`)
- A free Render account: https://render.com/

## Steps

### 1. Sign in to Render
Go to https://dashboard.render.com/ and log in with GitHub.

### 2. Create a new Web Service
- Click **New +** → **Web Service**
- Select **Build and deploy from a Git repository** → **Next**
- Connect your GitHub account if prompted, then pick the `pixel_connect` repo
- Click **Connect**

### 3. Configure the service
Render will auto-detect `render.yaml` in the repo. If not, fill in manually:

| Field             | Value                |
|-------------------|----------------------|
| Name              | `pixelconnect`       |
| Region            | (closest to you)     |
| Branch            | `claude/pixelconnect-game-setup-HDuoU` (or merge to `main` first) |
| Runtime           | `Node`               |
| Build Command     | `npm install`        |
| Start Command     | `npm start`          |
| Instance Type     | `Free`               |

### 4. Deploy
Click **Create Web Service**. Render will build + deploy (takes 2–5 min).

Once live, you'll get a URL like:
```
https://pixelconnect.onrender.com
```
That's your public game!

---

## Free tier limitations (important!)

Render's free plan has a few caveats that affect this app:

1. **Filesystem is ephemeral** — every deploy or restart wipes `data/*.json`.
   Users, posts, and purchases will be lost. For persistence, upgrade to a paid plan
   with a persistent disk, or migrate storage to a database (Render PostgreSQL free tier works).

2. **Service spins down after 15 min idle** — first request after idle
   takes ~30s to cold-start.

3. **750 free hours/month per workspace.**

## Upgrading to persistent storage

To keep user data across restarts, either:

**Option A — Add a persistent disk** (requires a paid plan):
Re-add this to `render.yaml`:
```yaml
disk:
  name: pixelconnect-data
  mountPath: /opt/render/project/src/data
  sizeGB: 1
```

**Option B — Switch to Render PostgreSQL** (free tier available):
Replace `src/storage.js` with a Postgres-backed version and add a `DATABASE_URL`
env var in Render. I can do this migration when you're ready.

---

## Updating the deployed site
Every push to the deployed branch triggers an automatic redeploy on Render.

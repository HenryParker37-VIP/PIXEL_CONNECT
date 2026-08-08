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
| Build Command     | `npm ci`             |
| Start Command     | `npm start`          |
| Instance Type     | `Free`               |
| Health Check Path | `/health`            |

### 4. Deploy
Click **Create Web Service**. Render will build + deploy (takes 2–5 min).

Once live, you'll get a URL like:
```
https://pixel-connect.onrender.com
```
That's your public game!

---

## Free-tier keep-awake monitoring (important!)

PixelConnect stays on Render's Free instance. Free web services can sleep after 15 minutes without inbound traffic, so use an external UptimeRobot monitor following the same pattern as Pastel Chat:

1. Create an UptimeRobot **HTTP(s)** monitor with this URL: `https://pixel-connect.onrender.com/health`
2. On UptimeRobot's Free plan, set the interval to **Every 5 minutes** (10 minutes is not an available Free interval).
3. **Filesystem is ephemeral** — every deploy or restart wipes `data/*.json`.
   Users, posts, and purchases will be lost. For persistence, upgrade to a paid plan
   with a persistent disk, or migrate storage to a database (Render PostgreSQL free tier works).

The monitor is an external request from a third-party service, not a self-ping from PixelConnect. It can reduce cold starts but cannot guarantee 24/7 availability or prevent all Render restarts.

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

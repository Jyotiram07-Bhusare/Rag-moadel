# Host LessonLoop on Render (frontend + Java backend + pgvector database)

Repo layout (this folder is the repo root):
```
frontend/   static site (index.html, css, js)
backend/    Java Spring Boot API (Dockerfile)
db/         schema + local docker-compose (Render creates the real database from render.yaml)
render.yaml Blueprint: creates database + backend + frontend in one go
```

## 1. Put the code on GitHub
```
cd C:\Users\Admin\Downloads\h\h
git init
git add .
git commit -m "LessonLoop: frontend, backend, db"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```
`.gitignore` already skips `backend/target`, `.DS_Store` and `__MACOSX`.

## 2. Create everything on Render
1. render.com → **New +** → **Blueprint** → connect the GitHub repo → **Apply**.
2. Render reads `render.yaml` and creates three things:
   - **lessonloop-db**: Postgres. The backend runs `CREATE EXTENSION vector` and creates the `doc_chunks` table by itself on start.
   - **lessonloop-backend**: built from `backend/Dockerfile`. `DATABASE_URL` is filled in automatically from the database.
   - **lessonloop-frontend**: static site served from `frontend/`.
3. Wait until all three show **Live** (the first backend build takes a few minutes).

## 3. Open it
- Open the **lessonloop-frontend** URL. On `*.onrender.com` the chat points to `https://lessonloop-backend.onrender.com` automatically.
  If Render added a random suffix to a name, open Settings → General → Engine → Live backend and paste the real backend URL, then press Test.
- ＋ → **Upload PDF or image**.

## Check it works
- `https://<backend-url>/health` must show `ok`.
- Backend logs should say `connected to Postgres: using pgvector`. If they say `using the in-memory vector store`, `DATABASE_URL` is missing or the database is not ready.

## Good to know (free plan)
- A free web service sleeps after 15 minutes without a request, and the first request after that can take about a minute. The backend prevents this: every 5 minutes it calls its own `/health` address (`KeepAlive.java`, using Render's `RENDER_EXTERNAL_URL`), so it stays awake. Set the environment variable `KEEP_ALIVE=off` to turn this off.
- Staying awake all day uses almost all of the free 750 instance hours per month. That is enough for one free web service, not for two.
- Free Render Postgres has limits (it can expire after some time). Check Render's current pricing page, and use a paid database for anything permanent.
- Not in this backend yet: `POST /api/run` (the generate → evaluate → regenerate lesson loop).

# Chikitsa HMS

## Local Dev
- Backend: `cd backend && npm i && node src/server.js`
- Frontend:
  - Mock mode: leave `VITE_API_BASE` empty → `cd frontend && npm i && npm run dev`
  - Real API: set `VITE_API_BASE` to your backend URL

## Deploy
- Backend: Render/Railway (root: backend)
- Frontend: Vercel/Netlify (root: frontend, output: dist)

## Env
backend/.env:
- PORT, MONGO_URI, JWT_SECRET, CORS_ORIGIN

frontend/.env:
- VITE_API_BASE

# SAP Procurement Full Stack Application

This package contains the connected frontend and backend for the SAP Procurement Document Verification Portal.

## Included
- `frontend/` - Vite + React application connected to the backend API
- `backend/` - Flask + MongoDB API with document upload, replace, view, download, delete, dashboard, reports, and notifications support

## What was connected
- Frontend dashboard now loads live backend summary, stage stats, and recent activity
- Notifications panel now reads and updates backend notifications
- PR / PO / GRN / Invoice screens now load live records from backend
- Upload, replace, view, download, and delete document actions are wired to backend APIs
- Invoice screen loads linked PR / PO / GRN aggregate details and supports MIRO handoff
- Reports screen now builds from live backend data
- Added frontend API proxy for local development
- Added backend delete endpoints and inline document viewing support

## Run the backend
1. Go to `backend/`
2. Create and activate a Python virtual environment
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Make sure MongoDB is running locally
5. Copy `.env.example` to `.env` if needed
6. Start the API:
   ```bash
   python run.py
   ```

Backend default URL: `http://127.0.0.1:5000`

## Run the frontend
1. Go to `frontend/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` if needed
4. Start Vite:
   ```bash
   npm run dev
   ```

Frontend default URL: `http://127.0.0.1:5173`

The frontend is already configured to proxy `/api` requests to `http://127.0.0.1:5000` during development.

## Build validation completed
- Frontend production build passed
- Backend Python compile check passed

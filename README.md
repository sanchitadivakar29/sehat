# Sehat — ASHA Home Survey System

## Run on Windows

1. Open this folder in VS Code.
2. Open Terminal in the `sehat` folder.
3. Install dependencies:
   `py -m pip install -r requirements.txt`
4. Start the backend:
   `py app.py`
5. Open `http://localhost:5000`.

Demo ASHA worker login:
- Worker ID: `ASHA-1001`
- Password: `sehat123`

Demo supervisor login:
- Supervisor ID: `SUP-1001`
- Password: `super123`

The login screen now has two modes:
- **ASHA Worker** — home registration, surveys, AI analysis, maps and reports for the logged-in worker.
- **Supervisor** — secure supervisor dashboard showing all registered homes, all surveys, ASHA worker coverage/activity, and recent login activity.

The app also has an offline/localStorage fallback when the Flask backend is not available.

## Project structure

- `app.py` — Flask API + SQLite database
- `index.html` — UI
- `style.css` — styles
- `app.js` — frontend logic
- `sehat.db` — SQLite database
- `requirements.txt` — Python dependencies
- `run.bat` — Windows launcher

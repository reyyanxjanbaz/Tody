# Tody Backend

Simple FastAPI server that proxies your Supabase data.

## Setup

```bash
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Configure

Copy `.env.example` to `.env` and fill in your Supabase values:

```bash
cp .env.example .env
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

API docs at http://localhost:8000/docs

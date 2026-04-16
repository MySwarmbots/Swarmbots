import os
import sqlite3
from app.config import settings

def get_conn():
    os.makedirs(os.path.dirname(settings.database_url), exist_ok=True)
    return sqlite3.connect(settings.database_url)

def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS validation_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, symbol TEXT, exchange TEXT, mode TEXT, expected_price REAL, actual_price REAL, expected_fee_bps REAL, actual_fee_bps REAL, drift_pct REAL, slippage_bps REAL, passed INTEGER, reasons TEXT)")
    cur.execute("CREATE TABLE IF NOT EXISTS rollout_gates (id INTEGER PRIMARY KEY CHECK (id = 1), mode TEXT, blocked INTEGER, reason TEXT)")
    cur.execute("INSERT OR IGNORE INTO rollout_gates (id, mode, blocked, reason) VALUES (1, 'shadow', 0, '')")
    conn.commit()
    conn.close()

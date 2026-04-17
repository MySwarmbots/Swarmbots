import os
import sqlite3
from app.config import settings

def get_conn():
    os.makedirs(os.path.dirname(settings.database_url), exist_ok=True)
    return sqlite3.connect(settings.database_url)

def init_db():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS rollout_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            stage TEXT,
            enabled INTEGER,
            blocked INTEGER,
            allocated_capital_usd REAL,
            failed_validations INTEGER,
            passed_validations INTEGER,
            anomaly_count INTEGER,
            reason TEXT
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS rollout_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            action TEXT,
            stage_before TEXT,
            stage_after TEXT,
            message TEXT
        )
    ''')
    cur.execute('''
        CREATE TABLE IF NOT EXISTS swarm_memory (
            agent_id TEXT PRIMARY KEY,
            memory TEXT,
            personality TEXT,
            role TEXT
        )
    ''')
    cur.execute("INSERT OR IGNORE INTO rollout_state (id, stage, enabled, blocked, allocated_capital_usd, failed_validations, passed_validations, anomaly_count, reason) VALUES (1, ?, 1, 0, 0, 0, 0, 0, '')", (settings.rollout_stage,))
    conn.commit()
    conn.close()

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_validation_run():
    r = client.post("/api/validation/run?symbol=BTCUSDT&exchange=binance&expected_price=100&actual_price=100.05&expected_fee_bps=6&actual_fee_bps=6")
    assert r.status_code == 200

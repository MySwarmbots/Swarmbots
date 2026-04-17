from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_prediction():
    r = client.get("/api/swarm/prediction")
    assert r.status_code == 200
    body = r.json()
    assert "direction" in body
    assert "debate" in body

import requests
from datetime import datetime

base = "http://127.0.0.1:5000/ingest"

rows = [
    ("M1", 12.6, 400, 600),
    ("M2", 12.4, 350, 600),
    ("M3", 12.1, 250, 600),
    ("M4", 11.9, 200, 600),
    ("M5", 12.7, 450, 600),
]

for mid, v, measured, rated in rows:
    r = requests.post(
        base,
        json={
            "machine_id": mid,
            "timestamp": datetime.utcnow().isoformat(),
            "voltage": v,
            "measured_cca": measured,
            "rated_cca": rated,
            "low_sg": "Yes",
            "battery_type": "Regular Flooded",
        },
    )
    print(mid, r.status_code, r.text)

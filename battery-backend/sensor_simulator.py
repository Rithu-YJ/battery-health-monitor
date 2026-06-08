import time
import random
import requests

BACKEND_URL = "http://127.0.0.1:5000/ingest"

# Add as many machines as you like here (M1..M460 etc.)
MACHINES = [f"M{i}" for i in range(1, 461)]  # change 7 to 461 to cover M1..M460

def generate_reading(machine_id):
    voltage = round(random.uniform(12.0, 12.9), 3)
    measured_cca = round(random.uniform(150, 750), 1)
    rated_cca = 324.0
    low_sg = random.choice(["Yes", "No"])
    battery_type = "Regular Flooded"
    return {
        "machine_id": machine_id,
        "voltage": voltage,
        "measured_cca": measured_cca,
        "rated_cca": rated_cca,
        "low_sg": low_sg,
        "battery_type": battery_type,
    }

def main():
    while True:
        for m in MACHINES:
            payload = generate_reading(m)
            try:
                r = requests.post(BACKEND_URL, json=payload, timeout=3)
                print(m, r.status_code)
            except Exception as e:
                print("Error sending data for", m, ":", e)
        time.sleep(5)  # wait 5 seconds between batches

if __name__ == "__main__":
    main()

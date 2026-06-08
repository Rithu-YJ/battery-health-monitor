from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from datetime import datetime, timedelta
import joblib
import pandas as pd
import numpy as np
import os
import json
import random

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///battery.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

class Reading(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    machine_id = db.Column(db.String(20), index=True, nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False)
    voltage = db.Column(db.Float, nullable=False)
    measured_cca = db.Column(db.Float, nullable=False)
    rated_cca = db.Column(db.Float, nullable=False)
    low_sg = db.Column(db.String(10))
    battery_type = db.Column(db.String(50))
    # NEW synthetic sensors
    temperature = db.Column(db.Float)    # degrees C
    vibration = db.Column(db.Float)      # mm/s or g
    predicted_label = db.Column(db.String(20))
    predicted_label_encoded = db.Column(db.Integer)
    prob_replace = db.Column(db.Float)
    prob_warning = db.Column(db.Float)
    prob_good = db.Column(db.Float)



# --------- Paths and constants ---------
TRAIN_DATA_CSV = "battery_500.csv"
DATA_DIR = "data"
READINGS_CSV = os.path.join(DATA_DIR, "readings.csv")
MODEL_PATH = os.path.join("model", "battery_health_rf_ros.pkl")
ENCODER_PATH = os.path.join("model", "label_encoder.pkl")
METRICS_PATH = os.path.join("model", "metrics.json")
NUMERIC_FEATURES = ["voltage", "measured_cca", "rated_cca"]


# --------- Load model and encoder once ---------
model = joblib.load(MODEL_PATH)
label_encoder = joblib.load(ENCODER_PATH)


# --------- Helpers for CSV "database" ---------
def ensure_csv_exists() -> None:
    """Make sure data/readings.csv exists with the correct columns; seed if possible."""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    # If already present, nothing to do
    if os.path.exists(READINGS_CSV):
        return

    base_cols = [
        "machine_id",
        "timestamp",
        "voltage",
        "measured_cca",
        "rated_cca",
        "low_sg",
        "battery_type",
        "predicted_label",
        "predicted_label_encoded",
        "prob_replace",
        "prob_warning",
        "prob_good",
    ]
    df_empty = pd.DataFrame(columns=base_cols)
    df_empty.to_csv(READINGS_CSV, index=False)

    # Optional: seed from training data
    if not os.path.exists(TRAIN_DATA_CSV):
        print(f"No {TRAIN_DATA_CSV} found, created empty {READINGS_CSV}")
        return

    try:
        seed_df = pd.read_csv(TRAIN_DATA_CSV)

        required_cols = {
            "voltage",
            "measured_cca",
            "rated_cca",
            "low_sg",
            "battery_type",
            "label",
        }
        if not required_cols.issubset(seed_df.columns):
            print(f"{TRAIN_DATA_CSV} is missing required columns: {required_cols}")
            return

        records = []
        n = len(seed_df)
        for i, row in seed_df.iterrows():
            machine_id = f"M{i + 1}"
            # Spread timestamps over last n minutes
            timestamp = pd.Timestamp.utcnow() - pd.Timedelta(minutes=(n - i))

            X_row = pd.DataFrame(
                [
                    {
                        "voltage": float(row["voltage"]),
                        "measured_cca": float(row["measured_cca"]),
                        "rated_cca": float(row["rated_cca"]),
                    }
                ]
            )

            y_pred_encoded = model.predict(X_row)[0]
            y_proba = model.predict_proba(X_row)[0].tolist()
            predicted_label = label_encoder.inverse_transform([y_pred_encoded])[0]

            proba_dict = {
                str(cls): prob for cls, prob in zip(label_encoder.classes_, y_proba)
            }
            prob_replace = float(proba_dict.get("Replace", 0.0))
            prob_warning = float(proba_dict.get("Warning", 0.0))
            prob_good = float(proba_dict.get("Good", 0.0))

            records.append(
                {
                    "machine_id": machine_id,
                    "timestamp": timestamp.isoformat(),
                    "voltage": float(row["voltage"]),
                    "measured_cca": float(row["measured_cca"]),
                    "rated_cca": float(row["rated_cca"]),
                    "low_sg": row["low_sg"],
                    "battery_type": row["battery_type"],
                    "predicted_label": predicted_label,
                    "predicted_label_encoded": int(y_pred_encoded),
                    "prob_replace": prob_replace,
                    "prob_warning": prob_warning,
                    "prob_good": prob_good,
                }
            )

        if records:
            seed_out = pd.DataFrame(records)
            df_all = pd.concat([df_empty, seed_out], ignore_index=True)
            df_all.to_csv(READINGS_CSV, index=False)
            print(f"Seeded {len(records)} rows from {TRAIN_DATA_CSV}")
    except Exception as e:
        print("Error seeding from training CSV:", e)


ensure_csv_exists()

def seed_db_from_training():
    """One-time: seed Reading table from battery_500.csv so we have many machines."""
    if not os.path.exists(TRAIN_DATA_CSV):
        print(f"No {TRAIN_DATA_CSV} found, skipping DB seed")
        return

    # If DB already has data, don't duplicate
    existing = db.session.query(Reading).count()
    if existing > 0:
        print("Reading table already has data, skipping DB seed")
        return

    try:
        df = pd.read_csv(TRAIN_DATA_CSV)

        required_cols = {
            "voltage",
            "measured_cca",
            "rated_cca",
            "low_sg",
            "battery_type",
        }
        if not required_cols.issubset(df.columns):
            print(f"{TRAIN_DATA_CSV} missing columns: {required_cols}")
            return

        n = len(df)
        records = []
        for i, row in df.iterrows():
            machine_id = f"M{i + 1}"  # M1..M460
            timestamp = pd.Timestamp.utcnow() - pd.Timedelta(minutes=(n - i))

            X_row = pd.DataFrame(
                [
                    {
                        "voltage": float(row["voltage"]),
                        "measured_cca": float(row["measured_cca"]),
                        "rated_cca": float(row["rated_cca"]),
                    }
                ]
            )
            y_pred_encoded = model.predict(X_row)[0]
            y_proba = model.predict_proba(X_row)[0].tolist()
            predicted_label = label_encoder.inverse_transform([y_pred_encoded])[0]

            proba_dict = {
                str(cls): prob
                for cls, prob in zip(label_encoder.classes_, y_proba)
            }
            prob_replace = float(proba_dict.get("Replace", 0.0))
            prob_warning = float(proba_dict.get("Warning", 0.0))
            prob_good = float(proba_dict.get("Good", 0.0))

            r = Reading(
                machine_id=machine_id,
                timestamp=timestamp.to_pydatetime(),
                voltage=float(row["voltage"]),
                measured_cca=float(row["measured_cca"]),
                rated_cca=float(row["rated_cca"]),
                low_sg=row.get("low_sg", "Yes"),
                battery_type=row.get("battery_type", "Regular Flooded"),
                predicted_label=predicted_label,
                predicted_label_encoded=int(y_pred_encoded),
                prob_replace=prob_replace,
                prob_warning=prob_warning,
                prob_good=prob_good,
            )
            records.append(r)

        if records:
            db.session.bulk_save_objects(records)
            db.session.commit()
            print(f"Seeded {len(records)} rows into Reading from {TRAIN_DATA_CSV}")
    except Exception as e:
        print("Error seeding DB from training CSV:", e)


# --------- /summary endpoint ---------


@app.route("/summary", methods=["GET"])
def summary():
    # latest row per machine
    latest_subq = (
        db.session.query(
            Reading.machine_id,
            func.max(Reading.timestamp).label("max_ts"),
        )
        .group_by(Reading.machine_id)
        .subquery()
    )

    latest_rows = (
        db.session.query(Reading)
        .join(
            latest_subq,
            (Reading.machine_id == latest_subq.c.machine_id)
            & (Reading.timestamp == latest_subq.c.max_ts),
        )
        .all()
    )

    if not latest_rows:
        return jsonify(
            {
                "total_machines": 0,
                "healthy": 0,
                "warning": 0,
                "failure": 0,
                "alerts_today": 0,
                "voltage_buckets": [],
                "label_buckets": [],
                "recent_readings": [],
            }
        ), 200

    total_machines = len(latest_rows)
    healthy = sum(1 for r in latest_rows if r.predicted_label in ("Good", "Normal"))
    warning = sum(1 for r in latest_rows if r.predicted_label == "Warning")
    failure = sum(
        1 for r in latest_rows if r.predicted_label in ("Failure", "Replace")
    )

    # alerts last 24h
    now = pd.Timestamp.utcnow()
    alerts_24h = (
        db.session.query(Reading)
        .filter(
            Reading.timestamp >= now - pd.Timedelta(days=1),
            Reading.predicted_label.in_(["Warning", "Failure", "Replace"]),
        )
        .count()
    )

    # voltage buckets using all rows
    all_rows = db.session.query(Reading).all()
    voltages = [r.voltage for r in all_rows if r.voltage is not None]
    if voltages:
        df_v = pd.DataFrame({"voltage": voltages})
        df_v["voltage_bucket"] = pd.cut(
            df_v["voltage"],
            bins=[12.0, 12.2, 12.4, 12.6, 12.8, np.inf],
            labels=["12.0-12.2", "12.2-12.4", "12.4-12.6", "12.6-12.8", "12.8+"],
            include_lowest=True,
        )
        voltage_buckets = (
            df_v.groupby("voltage_bucket")["voltage"]
            .count()
            .reset_index(name="count")
            .rename(columns={"voltage_bucket": "bucket"})
            .to_dict("records")
        )
    else:
        voltage_buckets = []

    # label buckets from latest
    from collections import Counter

    counts = Counter(r.predicted_label for r in latest_rows)
    label_buckets = [
        {"label": label, "count": int(count)} for label, count in counts.items()
    ]

    # recent readings (last 20 rows overall)
    recent_rows = (
        db.session.query(Reading)
        .order_by(Reading.timestamp.desc())
        .limit(20)
        .all()
    )
    recent = [
        {
            "machine_id": r.machine_id,
            "timestamp": r.timestamp.isoformat(),
            "voltage": r.voltage,
            "measured_cca": r.measured_cca,
            "rated_cca": r.rated_cca,
            "low_sg": r.low_sg,
            "battery_type": r.battery_type,
            "predicted_label": r.predicted_label,
        }
        for r in recent_rows
    ]

    return jsonify(
        {
            "total_machines": int(total_machines),
            "healthy": int(healthy),
            "warning": int(warning),
            "failure": int(failure),
            "alerts_today": int(alerts_24h),
            "voltage_buckets": voltage_buckets,
            "label_buckets": label_buckets,
            "recent_readings": recent,
        }
    ), 200



# --------- Prediction endpoint ---------
@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    try:
        voltage = float(data["voltage"])
        measured_cca = float(data["measured_cca"])
        rated_cca = float(data["rated_cca"])
        low_sg = data.get("low_sg", "Yes")
        battery_type = data.get("battery_type", "Regular Flooded")
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid or missing fields: {e}"}), 400

    X = pd.DataFrame(
        [
            {
                "voltage": voltage,
                "measured_cca": measured_cca,
                "rated_cca": rated_cca,
            }
        ]
    )
    y_pred_encoded = model.predict(X)[0]
    y_proba = model.predict_proba(X)[0].tolist()
    predicted_label = label_encoder.inverse_transform([y_pred_encoded])[0]

    proba_dict = {
        str(cls): prob for cls, prob in zip(label_encoder.classes_, y_proba)
    }
    return jsonify(
        {
            "predicted_label": predicted_label,
            "predicted_label_encoded": int(y_pred_encoded),
            "prob_replace": float(proba_dict.get("Replace", 0.0)),
            "prob_warning": float(proba_dict.get("Warning", 0.0)),
            "prob_good": float(proba_dict.get("Good", 0.0)),
            "probabilities": proba_dict,
            "low_sg": low_sg,
            "battery_type": battery_type,
        }
    ), 200


# --------- Ingest endpoint ---------
@app.route("/ingest", methods=["POST"])
def ingest():
    data = request.get_json()
    try:
        machine_id = data["machine_id"]
        timestamp = data.get("timestamp") or pd.Timestamp.utcnow().isoformat()
        voltage = float(data["voltage"])
        measured_cca = float(data["measured_cca"])
        rated_cca = float(data["rated_cca"])
        low_sg = data.get("low_sg", "Yes")
        battery_type = data.get("battery_type", "Regular Flooded")
        # NEW: extra sensors (use provided values or generate synthetic)
        temperature = float(data.get("temperature", random.uniform(25, 55)))
        vibration = float(data.get("vibration", random.uniform(0.5, 4.0)))
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid or missing fields: {e}"}), 400

    # Run model
    X = pd.DataFrame(
        [
            {
                "voltage": voltage,
                "measured_cca": measured_cca,
                "rated_cca": rated_cca,
            }
        ]
    )
    y_pred_encoded = model.predict(X)[0]
    y_proba = model.predict_proba(X)[0].tolist()
    predicted_label = label_encoder.inverse_transform([y_pred_encoded])[0]

    proba_dict = {
        str(cls): prob for cls, prob in zip(label_encoder.classes_, y_proba)
    }
    prob_replace = float(proba_dict.get("Replace", 0.0))
    prob_warning = float(proba_dict.get("Warning", 0.0))
    prob_good = float(proba_dict.get("Good", 0.0))

    # ---- store in SQLite via SQLAlchemy ----
    reading = Reading(
        machine_id=machine_id,
        timestamp=pd.to_datetime(timestamp),
        voltage=voltage,
        measured_cca=measured_cca,
        rated_cca=rated_cca,
        low_sg=low_sg,
        battery_type=battery_type,
        temperature=temperature,
        vibration=vibration,
        predicted_label=predicted_label,
        predicted_label_encoded=int(y_pred_encoded),
        prob_replace=prob_replace,
        prob_warning=prob_warning,
        prob_good=prob_good,
    )
    db.session.add(reading)
    db.session.commit()

    # ---- CSV append (optional) ----
    ensure_csv_exists()
    new_row = pd.DataFrame(
        [
            {
                "machine_id": machine_id,
                "timestamp": timestamp,
                "voltage": voltage,
                "measured_cca": measured_cca,
                "rated_cca": rated_cca,
                "low_sg": low_sg,
                "battery_type": battery_type,
                # optional: also store extra sensors in CSV if you add columns
                # "temperature": temperature,
                # "vibration": vibration,
                "predicted_label": predicted_label,
                "predicted_label_encoded": int(y_pred_encoded),
                "prob_replace": prob_replace,
                "prob_warning": prob_warning,
                "prob_good": prob_good,
            }
        ]
    )

    df_existing = pd.read_csv(READINGS_CSV)
    df_all = pd.concat([df_existing, new_row], ignore_index=True)
    df_all.to_csv(READINGS_CSV, index=False)

    return (
        jsonify(
            {
                "status": "stored",
                "predicted_label": predicted_label,
                "probabilities": {
                    "Replace": prob_replace,
                    "Warning": prob_warning,
                    "Good": prob_good,
                },
                "temperature": temperature,
                "vibration": vibration,
            }
        ),
        201,
    )


# --------- Machines list ---------
@app.route("/machines", methods=["GET"])
def get_machines():
    latest_subq = (
        db.session.query(
            Reading.machine_id,
            func.max(Reading.timestamp).label("max_ts"),
        )
        .group_by(Reading.machine_id)
        .subquery()
    )

    latest_rows = (
        db.session.query(Reading)
        .join(
            latest_subq,
            (Reading.machine_id == latest_subq.c.machine_id)
            & (Reading.timestamp == latest_subq.c.max_ts),
        )
        .all()
    )

    machines = []
    for r in latest_rows:
        # base on final label first
        if r.predicted_label == "Good":
            base = 85.0
        elif r.predicted_label == "Warning":
            base = 50.0
        elif r.predicted_label in ("Failure", "Replace"):
            base = 15.0
        else:
            base = 60.0  # fallback

        # small adjustment using probabilities (optional)
        adjust = 20.0 * (r.prob_good or 0.0) - 10.0 * (r.prob_replace or 0.0)
        score = max(0.0, min(100.0, base + adjust))

        machines.append(
            {
                "machine_id": r.machine_id,
                "timestamp": r.timestamp.isoformat(),
                "predicted_label": r.predicted_label,
                "voltage": r.voltage,
                "measured_cca": r.measured_cca,
                "rated_cca": r.rated_cca,
                "low_sg": r.low_sg,
                "battery_type": r.battery_type,
                "temperature": r.temperature,
                "vibration": r.vibration,
                "health_score": score,
            }
        )

    machines.sort(key=lambda m: m["health_score"])
    return jsonify(machines)

# --------- Anomalies ---------
@app.route("/anomalies", methods=["GET"])
def get_anomalies():
    if not os.path.exists(READINGS_CSV):
        return jsonify([])
    df = pd.read_csv(READINGS_CSV)
    if df.empty:
        return jsonify([])

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"])
    latest = df.sort_values("timestamp").groupby("machine_id").tail(1)

    risky = latest[
        latest["predicted_label"].isin(["Warning", "Replace", "Failure"])
    ][["machine_id", "timestamp", "predicted_label"]].to_dict("records")
    return jsonify(risky)


# --------- Machine history ---------
@app.route("/machines/<machine_id>/history", methods=["GET"])
def get_machine_history(machine_id):
    rows = (
        db.session.query(Reading)
        .filter(Reading.machine_id == machine_id)
        .order_by(Reading.timestamp.asc())
        .all()
    )
    history = [
        {
            "timestamp": r.timestamp.isoformat(),
            "voltage": r.voltage,
            "measured_cca": r.measured_cca,
            "rated_cca": r.rated_cca,
            "temperature": r.temperature,
            "vibration": r.vibration,
            "predicted_label": r.predicted_label,
        }
        for r in rows
    ]
    return jsonify(history)


@app.route("/model-metrics", methods=["GET"])
def model_metrics():
    if not os.path.exists(METRICS_PATH):
        return jsonify({"error": "metrics not available"}), 404
    with open(METRICS_PATH, "r") as f:
        data = json.load(f)
    return jsonify(data), 200

@app.route("/alerts-history", methods=["GET"])
def alerts_history():
    # query params: ?days=7&severity=Warning (both optional)
    days = int(request.args.get("days", 7))
    severity = request.args.get("severity")  # "Warning" / "Failure" / "Replace"

    since = datetime.utcnow() - timedelta(days=days)

    # base query: only risky labels in last N days
    q = db.session.query(Reading).filter(
        Reading.timestamp >= since,
        Reading.predicted_label.in_(["Warning", "Failure", "Replace"]),
    )
    if severity:
        q = q.filter(Reading.predicted_label == severity)

    rows = (
        q.order_by(Reading.timestamp.desc())
        .limit(500)
        .all()
    )

    alerts = []
    for r in rows:
        reasons = []
        if r.predicted_label in ("Failure", "Replace"):
            reasons.append("Model: high failure probability")
        elif r.predicted_label == "Warning":
            reasons.append("Model: warning state")

        if r.temperature is not None and r.temperature > 50:
            reasons.append("High temperature")
        if r.vibration is not None and r.vibration > 3.5:
            reasons.append("Abnormal vibration")

        alerts.append(
            {
                "machine_id": r.machine_id,
                "timestamp": r.timestamp.isoformat(),
                "label": r.predicted_label,
                "voltage": r.voltage,
                "temperature": r.temperature,
                "vibration": r.vibration,
                "reason": ", ".join(reasons) or "Model threshold",
            }
        )

    # this must be the last line of the function
    return jsonify(alerts), 200


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_db_from_training()  # NEW call for DB seeding
    app.run(debug=True)

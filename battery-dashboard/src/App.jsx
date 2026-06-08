import React, { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter as Router,
  Link,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  Bar,
  BarChart,
  LabelList
} from "recharts";

function classNames(...args) {
  return args.filter(Boolean).join(" ");
}

function exportToCsv(filename, rows) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const v = row[h] ?? "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ConnectionPill({ status }) {
  const color =
    status === "connected"
      ? "pill pill-good"
      : status === "degraded"
      ? "pill pill-warn"
      : "pill pill-replace";

  const label =
    status === "connected" ? "Connected" : status === "degraded" ? "Degraded" : "Offline";

  return (
    <span className={classNames("summary-pill", color)}>
      <span className="pill-dot" />
      {label}
    </span>
  );
}

function StatusBadge({ label }) {
  const map = {
    Good: "status-badge pill-good",
    Normal: "status-badge",
    Warning: "status-badge pill-warn",
    Failure: "status-badge pill-replace",
    Replace: "status-badge pill-replace",
  };
  const cls = map[label] || "status-badge";
  return <span className={cls}>{label}</span>;
}

function SeverityLegend() {
  return (
    <div className="severity-legend">
      <span className="severity-label">Legend</span>
      <StatusBadge label="Good" />
      <StatusBadge label="Warning" />
      <StatusBadge label="Failure" />
      <StatusBadge label="Replace" />
    </div>
  );
}


function Toast({ toast, onClose }) {
  if (!toast) return null;
  const base = "toast";
  const typeClass =
    toast.type === "success"
      ? "toast-success"
      : toast.type === "error"
      ? "toast-error"
      : "toast-info";
  return (
    <div className={classNames(base, typeClass)}>
      <div className="toast-dot" />
      <div className="toast-message">{toast.message}</div>
      <button className="toast-close" onClick={onClose}>
        ×
      </button>
    </div>
  );
}

/* ---------------- Dashboard overview ---------------- */

/* ---------------- Dashboard overview ---------------- */

function DashboardPage({ connectionStatus, stats, onRefresh, loading }) {
  const [machines, setMachines] = useState([]);

  useEffect(() => {
    async function loadMachines() {
      try {
        const res = await fetch("http://127.0.0.1:5000/machines");
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        setMachines(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load machines", e);
        setMachines([]);
      }
    }
    loadMachines();
  }, []);

  const statusCounts = ["Good", "Warning", "Failure", "Replace"].map(
    (label) => ({
      label,
      count: machines.filter((m) => m.predicted_label === label).length,
    })
  );

  return (
    <div className="page">
      <div className="overview-top">
        <div>
          <h1 className="section-title">Overview</h1>
          <p className="app-subtitle">
            Real-time health and predicted failures across all batteries.
          </p>
          <SeverityLegend />
        </div>

        <div className="header-actions">
          <ConnectionPill status={connectionStatus} />
          <button
            type="button"
            onClick={onRefresh}
            className="btn-secondary"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-label">Machines</div>
          <div className="kpi-value">{stats.totalMachines ?? "--"}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Healthy</div>
          <div className="kpi-value kpi-value-healthy">
            {stats.healthy ?? "--"}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Warning</div>
          <div className="kpi-value kpi-value-warning">
            {stats.warning ?? "--"}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Failure risk</div>
          <div className="kpi-value kpi-value-failure">
            {stats.failure ?? "--"}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Alerts today</div>
          <div className="kpi-value kpi-value-alerts">
            {stats.alertsToday ?? "--"}
          </div>
        </div>
      </div>

      <div className="quick-row">
        <div className="quick-card">
          <h2 className="section-title">Fleet status</h2>
          <p className="card-metric">
            {stats.totalMachines ?? "--"}
            <span className="card-metric-sub"> machines monitored</span>
          </p>
          <ul className="card-list">
            <li>
              Healthy <strong>{stats.healthy ?? "--"}</strong>
            </li>
            <li>
              Warning <strong>{stats.warning ?? "--"}</strong>
            </li>
            <li>
              Failure risk <strong>{stats.failure ?? "--"}</strong>
            </li>
          </ul>
        </div>

        <div className="quick-result-card">
          <h2 className="quick-result-title">Today’s alerts</h2>
          <p className="quick-result-status">
            {stats.alertsToday ?? "--"} alerts in the last 24 hours.
          </p>
        </div>

        <div className="quick-result-card">
          <h2 className="quick-result-title">Model performance</h2>
          <p className="quick-result-status">
            96–97% test accuracy · Random Forest (balanced)
          </p>
        </div>
      </div>

      <section className="card-block">
        <h2 className="section-title">Voltage &amp; risk distribution</h2>
        <div className="quick-row">
          <div className="chart-col" style={{ minWidth: 0, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.voltageBuckets || []}
                margin={{ top: 20, right: 16, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  stroke="#1f2937"
                  vertical={false}
                  strokeDasharray="3 3"
                />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#02050eff",
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    fontSize: 11,
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Batteries"
                  radius={[4, 4, 0, 0]}
                  fill="#52f8383e"
                >
                  <LabelList
                    dataKey="count"
                    position="insideTop"
                    style={{
                      fontSize: 11,
                      fill: "#0b1120",
                      fontWeight: 500,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-col" style={{ minWidth: 0, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.labelBuckets || []} layout="vertical">
                <CartesianGrid
                  stroke="#1f2937"
                  horizontal={false}
                  strokeDasharray="3 3"
                />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020617",
                    borderRadius: 8,
                    border: "1px solid #1f2937",
                    fontSize: 11,
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Batteries"
                  radius={[4, 4, 0, 0]}
                  fill="#38c8f865"
                >
                  <LabelList
                    dataKey="count"
                    position="insideTop"
                    style={{
                      fontSize: 11,
                      fill: "#0b1120",
                      fontWeight: 500,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Fleet health overview */}
      <div className="card-block">
        <h3 className="section-title">Fleet health overview</h3>
        <div className="mini-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusCounts}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#020617",
                  borderRadius: 8,
                  border: "1px solid #1f2937",
                  fontSize: 11,
                }}
              />
              <Bar
                dataKey="count"
                name="Batteries"
                radius={[4, 4, 0, 0]}
                fill="#f838bb56"
              >
                <LabelList
                  dataKey="count"
                  position="insideTop"
                  style={{
                    fontSize: 11,
                    fill: "#0b1120",
                    fontWeight: 500,
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 24 }}>
        Machines
      </h2>
      <div className="machine-grid">
        {machines.map((m) => (
          <div key={m.machine_id} className="machine-card">
            <div className="machine-card-header">
              <h3 className="machine-title">
                {m.machine_id?.startsWith("M")
                  ? `M-${m.machine_id.slice(1)}`
                  : m.machine_id}
              </h3>
              <StatusBadge label={m.predicted_label} />
            </div>
            <p className="machine-timestamp">
              {m.timestamp
                ? new Date(m.timestamp).toLocaleString()
                : ""}
            </p>
            <p className="machine-meta">
              Health score{" "}
              {m.health_score != null
                ? m.health_score.toFixed(1)
                : "N/A"}
              /100
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
      
      
/* ---------------- Recent page ---------------- */

function RecentTablePage({ recentReadings }) {
  const navigate = useNavigate();
  return (
    <div className="page">
      <header className="overview-top">
        <div>
          <h1 className="section-title">Recent predictions</h1>
          <p className="app-subtitle">
            Latest readings and model outputs from all machines.
          </p>
        </div>
      </header>

      <div className="card-block stretch">
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Machine</th>
                <th>Voltage</th>
                <th>CCA</th>
                <th>Label</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {(!recentReadings || recentReadings.length === 0) && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No data received yet.
                  </td>
                </tr>
              )}
              {recentReadings &&
                recentReadings.map((row, idx) => (
                  <tr key={idx}>
                    <td>
  {row.timestamp
    ? new Date(row.timestamp).toLocaleString()
    : ""}
</td>

                    <td>
  {row.machine_id?.startsWith("M")
    ? `M-${row.machine_id.slice(1)}`
    : row.machine_id}
</td>

                    <td>{row.voltage?.toFixed?.(2) ?? row.voltage}</td>
                    <td>
                      {row.measured_cca?.toFixed?.(0) ?? row.measured_cca}/
                      {row.rated_cca}
                    </td>
                    <td>
                      <StatusBadge label={row.predicted_label} />
                    </td>
                    <td>
  <button
    type="button"
    className="link-button link-button-small"
    onClick={() => navigate(`/machines/${row.machine_id}`)}
  >
    View
  </button>
</td>

                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Alerts page ---------------- */

function AlertsFromRecentPage() {
  const [alerts, setAlerts] = useState([]);
  const [days, setDays] = useState(7);
  const [severity, setSeverity] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAlerts(params = {}) {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      const d = params.days ?? days;
      const s = params.severity ?? severity;

      query.set("days", d);
      if (s) {
        query.set("severity", s);
      }

      const res = await fetch(
        `http://127.0.0.1:5000/alerts-history?${query.toString()}`
      );
      if (!res.ok) throw new Error("Network");
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }

  // ---- add here ----
  function buildAlertsPerHour(alerts) {
    const now = new Date();
    const buckets = [];

    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = d.toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
      buckets.push({
        hourKey,
        label: d.toLocaleTimeString([], { hour: "2-digit" }),
        count: 0,
      });
    }

    const indexByKey = Object.fromEntries(
      buckets.map((b, idx) => [b.hourKey, idx])
    );

    alerts.forEach((a) => {
      if (!a.timestamp) return;
      const key = String(a.timestamp).slice(0, 13);
      const idx = indexByKey[key];
      if (idx !== undefined) buckets[idx].count += 1;
    });

    return buckets;
  }

  const alertsPerHour = buildAlertsPerHour(alerts);
  // ---- end added block ----

  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApply() {
    loadAlerts({ days, severity });
  }

  return (
    <div className="page">
      <header className="overview-top">
        <div>
          <h1 className="section-title">Alerts</h1>
          <p className="app-subtitle">
            Batteries that need attention based on recent predictions.
          </p>
        </div>
        <SeverityLegend />
      </header>

      {/* Filters */}
      <div className="card-block">
        <div className="alerts-filters">
          <label className="field">
            <span>Lookback window (days)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <label className="field">
            <span>Severity</span>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
            >
              <option value="">All</option>
              <option value="Warning">Warning</option>
              <option value="Failure">Failure</option>
              <option value="Replace">Replace</option>
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleApply}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
      </div>
      
      {/* NEW: alerts per hour chart */}
    <div className="card-block">
      <h3 className="section-title">Alerts in last 24 hours</h3>
      <div className="mini-chart">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={alertsPerHour}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#020617",
                borderRadius: 8,
                border: "1px solid #1f2937",
                fontSize: 11,
              }}
              labelFormatter={(_, idx) =>
                alertsPerHour[idx]?.hourKey ?? ""
              }
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>

      {/* Alerts list */}
      <div className="card-block stretch">
        {loading && <p className="info-text">Loading alerts...</p>}
        {!loading && alerts.length === 0 && (
          <p className="info-text">No alerts for this filter.</p>
        )}
        {!loading && alerts.length > 0 && (
          <ul className="alerts-list">
            {alerts.map((a, idx) => (
              <li key={idx} className="alert-card">
  <div className="alert-header">
    <span className="alert-id">
      Machine{" "}
      {a.machine_id?.startsWith("M")
        ? `M-${a.machine_id.slice(1)}`
        : a.machine_id}
    </span>
    <span className="alert-label">
      <StatusBadge label= {a.label} />
    </span>
  </div>
                  <p className="alert-meta">
    {a.timestamp
      ? new Date(a.timestamp).toLocaleString()
      : ""}{" "}
    · V:- {" "}
    {a.voltage != null ? Number(a.voltage).toFixed(2) : "N/A"}{" "}
    · T:- {" "}
    {a.temperature != null
      ? Number(a.temperature).toFixed(1)
      : "N/A"}
    °C · Vib:- {" "}
    {a.vibration != null
      ? Number(a.vibration).toFixed(2)
      : "N/A"}
  </p>
                <p className="alert-meta">
                  Reason {a.reason || "Model threshold breach"}
               </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


/* ---------------- Machine detail page ---------------- */

function MachineDetailPage({ pushToast }) {
  const { machineId } = useParams();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [latest, setLatest] = useState(null);
  const [liveFeed, setLiveFeed] = useState([]);
  const [notes, setNotes] = useState("");
  const [notesSavedAt, setNotesSavedAt] = useState(null);
  
  function getTrend(history) {
  if (!history || history.length < 2) return "Stable";

  const lastThree = history.slice(-3).map((r) => r.predicted_label);
  const hasFailure = lastThree.includes("Failure") || lastThree.includes("Replace");
  const hasWarning = lastThree.includes("Warning");
  const allGood = lastThree.every((l) => l === "Good");

  if (hasFailure) return "Degrading";
  if (hasWarning && !allGood) return "Degrading";
  if (allGood) return "Stable";
  return "Fluctuating";
}


  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        `machine_notes_${machineId}`
      );
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotes(parsed.text || "");
        setNotesSavedAt(parsed.savedAt || null);
      } else {
        setNotes("");
        setNotesSavedAt(null);
      }
    } catch {
      setNotes("");
      setNotesSavedAt(null);
    }
  }, [machineId]);

  useEffect(() => {
    let mounted = true;

    async function fetchHistory() {
      try {
        const res = await fetch(
          `http://127.0.0.1:5000/machines/${machineId}/history`
        );
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        if (!mounted) return;
        setHistory(Array.isArray(data) ? data : []);
        setError(null);
        if (Array.isArray(data) && data.length > 0) {
          const last = data[data.length - 1];
          setLatest(last);
          setLiveFeed((prev) => {
            const next = [...prev, last];
            return next.slice(-20);
          });
        }
      } catch {
        if (!mounted) return;
        setError("Could not load history");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }

    fetchHistory();
    const id = setInterval(fetchHistory, 5000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [machineId]);

  function handleExportCsv() {
    if (!history || history.length === 0) {
      pushToast?.("No history to export.", "info");
      return;
    }
    setExporting(true);
    try {
      exportToCsv(`machine_${machineId}_history.csv`, history);
      pushToast?.("CSV export started.", "success");
    } catch {
      pushToast?.("CSV export failed.", "error");
    } finally {
      setExporting(false);
    }
  }

  function handleSaveNotes(e) {
    e.preventDefault();
    try {
      const savedAt = new Date().toLocaleString();
      window.localStorage.setItem(
        `machine_notes_${machineId}`,
        JSON.stringify({ text: notes, savedAt })
      );
      setNotesSavedAt(savedAt);
      pushToast?.("Notes saved for this machine.", "success");
    } catch {
      pushToast?.("Could not save notes.", "error");
    }
  }

  function handleClearNotes() {
    try {
      setNotes("");
      setNotesSavedAt(null);
      window.localStorage.removeItem(`machine_notes_${machineId}`);
      pushToast?.("Notes cleared.", "info");
    } catch {
      pushToast?.("Could not clear notes.", "error");
    }
  }

  return (
    <div className="detail-page">
      <Link to="/" className="back-link">
        ← Back to dashboard
      </Link>

      <div className="detail-header-row">
        <h2 className="detail-title">
  Machine{" "}
  {machineId?.startsWith("M")
    ? `M-${machineId.slice(1)}`
    : machineId}
</h2>
        <button
          type="button"
          className="btn-secondary btn-export"
          onClick={handleExportCsv}
          disabled={history.length === 0 || exporting}
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {latest && (
        <div className="card-block">
          <h3 className="section-title">Current status</h3>
          <p className="recent-meta">
            Last update{" "}
            {latest.timestamp
              ? new Date(latest.timestamp).toLocaleString()
              : ""}{" "}
            · Status:- {" "}
  <StatusBadge label={latest.predicted_label} />
          </p>

          <p className="recent-meta">
            Voltage:- {" "}
            {latest.voltage != null
              ? Number(latest.voltage).toFixed(2)
              : "N/A"}{" "}
            V · Measured CCA:- {" "}
            {latest.measured_cca != null
              ? Number(latest.measured_cca).toFixed(0)
              : "N/A"}{" "}
            · Rated CCA:- {" "}
            {latest.rated_cca != null && latest.rated_cca.toFixed
              ? Number(latest.rated_cca).toFixed(0)
              : latest.rated_cca ?? "N/A"}
          </p>
        
        <p className="recent-meta">
  Trend{" "}
  <span
    className={
      getTrend(history) === "Degrading"
        ? "trend-badge trend-badge-bad"
        : getTrend(history) === "Fluctuating"
        ? "trend-badge trend-badge-warn"
        : "trend-badge trend-badge-good"
    }
  >
    {getTrend(history)}
  </span>
</p>


        </div>
      )}



      {loading && <p className="info-text">Loading history...</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && history.length === 0 && (
        <p className="info-text">No history data available.</p>
      )}

      {!loading && !error && history.length > 0 && (
        <>
          <div className="card-block">
            <h3 className="section-title">Voltage &amp; CCA over time</h3>
            <div
              className="history-chart detail-chart"
              style={{ minWidth: 0, minHeight: 260 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={history}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid
                    stroke="#4b5563"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    tickFormatter={(v) => {
                      if (!v) return v;
                      const d = new Date(v);
                      return d.toLocaleTimeString();
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#020617",
                      borderRadius: 8,
                      border: "1px solid #1f2937",
                      padding: "6px 8px",
                      fontSize: 11,
                    }}
                    labelStyle={{ color: "#e5e7eb", marginBottom: 4 }}
                    labelFormatter={(v) =>
                      v ? new Date(v).toLocaleString() : ""
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="voltage"
                    name="Voltage (V)"
                    stroke="#38bdf8"
                    strokeWidth={2.2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="measured_cca"
                    name="Measured CCA"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card-block">
            <h3 className="section-title">Live feed (last updates)</h3>
            {liveFeed.length === 0 ? (
              <p className="info-text">Waiting for new readings...</p>
            ) : (
              <div className="live-feed-list">
                {liveFeed
                  .slice()
                  .reverse()
                  .map((item, idx) => (
                    <div key={idx} className="live-feed-item">
                      <div className="live-feed-time">
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleString()
                          : ""}
                      </div>
                      <div className="live-feed-row">
                        <span>
                          V:- {" "}
                          {item.voltage != null
                            ? Number(item.voltage).toFixed(2)
                            : "N/A"}
                        </span>
                        <span>
                          {" "}
                          · CCA:- {" "}
                          {item.measured_cca != null
                            ? Number(item.measured_cca).toFixed(0)
                            : "N/A"}
                        </span>
                        <span> 
                          {" "}
    · Status:- {" "}
    <StatusBadge label={item.predicted_label} />
    </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            <p className="live-feed-note">
              Auto-refresh every 5 seconds · showing latest 20 readings.
            </p>
          </div>

          <div className="card-block">
            <h3 className="section-title">Recent readings</h3>
            <ul className="history-list">
              {history
                .slice()
                .reverse()
                .slice(0, 5)
                .map((row) => (
                  <li key={row.timestamp} className="history-item">
                    <p>
                      {row.timestamp
                        ? new Date(row.timestamp).toLocaleString()
                        : ""}
                    </p>
                    <p>
                      V:- {" "}
                      {row.voltage != null
                        ? Number(row.voltage).toFixed(2)
                        : "N/A"}{" "}
                      · CCA:- {" "}
                      {row.measured_cca != null
                        ? Number(row.measured_cca).toFixed(0)
                        : "N/A"}{" "}
                      · Status:- {" "}
  <StatusBadge label={row.predicted_label} />
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        </>
      )}

      <div className="card-block notes-card">
        <h3 className="section-title">Technician notes</h3>
        <p className="recent-meta">
          Use this area to record maintenance actions or observations for this
          machine. Notes are stored in this browser only.
        </p>

        <form onSubmit={handleSaveNotes} className="notes-form">
          <textarea
            className="notes-textarea"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: Cleaned terminals, voltage recovered after charge..."
          />
          <div className="notes-actions">
            <button type="submit" className="btn-primary btn-notes-save">
              Save notes
            </button>
            <button
              type="button"
              className="btn-secondary btn-notes-clear"
              onClick={handleClearNotes}
              disabled={!notes}
            >
              Clear
            </button>
            {notesSavedAt && (
              <span className="notes-saved-at">
                Last saved {notesSavedAt}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Locations ---------------- */
function LocationsBySitePage() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synthetic logical locations (segments)
  const locations = [
    { name: "City fleet" },
    { name: "Industrial backup" },
    { name: "Workshop tests" },
  ];

  useEffect(() => {
    let mounted = true;
    async function fetchMachines() {
      try {
        const res = await fetch("http://127.0.0.1:5000/machines");
        if (!res.ok) throw new Error("Network");
        const data = await res.json();
        if (!mounted) return;
        setMachines(Array.isArray(data) ? data : []);
        setError(null);
      } catch {
        if (!mounted) return;
        setError("Could not load machines");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    fetchMachines();
    return () => {
      mounted = false;
    };
  }, []);

  // Evenly distribute machines across the three locations
  const byLocation = locations.map((loc, idx) => {
    const siteMachines = (machines || []).filter(
      (m) =>
        (parseInt(m.machine_id.replace("M", ""), 10) - 1) %
          locations.length ===
        idx
    );
    return { site: loc.name, machines: siteMachines };
  });

  // NEW: summary per location
  const summaryByLocation = byLocation.map(({ site, machines: ms }) => {
    const atRisk = ms.filter((m) =>
      ["Warning", "Failure", "Replace"].includes(m.predicted_label)
    ).length;
    return { site, total: ms.length, atRisk };
  });

  return (
    <div className="detail-page">
      <Link to="/" className="back-link">
        ← Back to dashboard
      </Link>
      <h2 className="detail-title">Locations</h2>

      <div className="card-block">
        <h3 className="section-title">Sites &amp; installed batteries</h3>
        <p className="recent-meta">
          Machines are grouped into example segments (fleet, backup, workshop).
        </p>
      </div>

      {/* mini summary strip */}
      {!loading && !error && (
        <div className="locations-summary-strip">
          {summaryByLocation.map((s) => (
            <div key={s.site} className="locations-summary-pill">
              <span className="locations-summary-name">{s.site}</span>
              <span className="locations-summary-count">
                {s.total} machines
              </span>
              <span className="locations-summary-risk">
                {s.atRisk} at risk
              </span>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="info-text">Loading...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="locations-grid">
          {byLocation.map(({ site, machines: ms }) => (
            <div key={site} className="location-card">
              <div className="location-header">
                <h3 className="location-title">{site}</h3>
                <span className="location-count">
                  {ms.length} machine{ms.length === 1 ? "" : "s"}
                </span>
              </div>
              {ms.length === 0 ? (
                <p className="info-text">No machines mapped yet.</p>
              ) : (
                <ul className="location-list">
                  {ms.map((m) => (
                    <li key={m.machine_id} className="location-item">
                      <span className="location-machine-id">
                        {m.machine_id?.startsWith("M")
                          ? `M-${m.machine_id.slice(1)}`
                          : m.machine_id}
                      </span>
                      <span className="location-machine-status">
                        <StatusBadge label={m.predicted_label} />
                      </span>
                      <span className="location-machine-time">
                        {m.timestamp
                          ? new Date(m.timestamp).toLocaleTimeString()
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




/* ---------------- Model insights ---------------- */

function ModelInsightsPage() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const res = await fetch("http://127.0.0.1:5000/model-metrics");
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        setMetrics(data);
        setError(null);
      } catch (e) {
        setError("Could not load metrics");
      }
    }
    loadMetrics();
  }, []);

  const featureImportances = [
    { name: "voltage", value: 0.4 },
    { name: "measured_cca", value: 0.35 },
    { name: "rated_cca", value: 0.15 },
    { name: "low_sg", value: 0.1 },
  ];

  const rf = metrics?.random_forest;
  const gb = metrics?.gradient_boosting;

  return (
    <div className="detail-page">
      <Link to="/" className="back-link">
        ← Back to dashboard
      </Link>
      <h2 className="detail-title">Model insights</h2>

      <div className="model-grid">
        <div className="card-block">
          <h3 className="section-title">Overall performance</h3>
          {error && <p className="error-text">{error}</p>}
          {!metrics && !error && (
            <p className="recent-meta">Loading metrics from model API...</p>
          )}
          {metrics && (
            <>
              <p className="recent-meta">
                Comparing Random Forest and Gradient Boosting on test data.
              </p>
              <ul className="metric-list">
                <li>
                  RF accuracy: {(rf.accuracy * 100).toFixed(1)}%
                </li>
                <li>
                  RF F1 (macro): {(rf.f1_macro * 100).toFixed(1)}%
                </li>
                <li>
                  GB accuracy: {(gb.accuracy * 100).toFixed(1)}%
                </li>
                <li>
                  GB F1 (macro): {(gb.f1_macro * 100).toFixed(1)}%
                </li>
              </ul>
            </>
          )}
        </div>

        <div className="card-block">
          <h3 className="section-title">Feature importance</h3>
          <div className="feature-list">
            {featureImportances.map((f) => (
              <div key={f.name} className="meter-row">
                <span className="meter-label">{f.name}</span>
                <div className="meter-track">
                  <div
                    className="meter-fill"
                    style={{ width: `${f.value * 100}%` }}
                  />
                </div>
                <span className="meter-value">
                  {(f.value * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-block">
        <h3 className="section-title">Notes</h3>
        <p className="recent-meta">
          Metrics are loaded from the backend evaluation API exposing test-set
          performance for both models.
        </p>
      </div>
    </div>
  );
}


/* ---------------- Settings ---------------- */

function SettingsPage({ pushToast }) {
  const [thresholds, setThresholds] = useState({
    voltage_low: 12.2,
    cca_low_ratio: 0.5,
    warning_ratio: 0.8,
    high_temp: 50,
    high_vibration: 3.5,
    default_severity: "Warning",
    refresh_interval: 5000,
    savedAt: null,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("battery_settings");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setThresholds((t) => ({ ...t, ...parsed }));
    } catch {
      // ignore parse errors
    }
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setThresholds((t) => ({
      ...t,
      [name]:
        name === "default_severity"
          ? value
          : name === "refresh_interval"
          ? Number(value)
          : Number(value),
    }));
    setSaved(false);
  }

  function handleSave(e) {
    e.preventDefault();
    const now = new Date().toLocaleString();
    const payload = { ...thresholds, savedAt: now };

    try {
      window.localStorage.setItem(
        "battery_settings",
        JSON.stringify(payload)
      );
      setThresholds(payload);
      setSaved(true);
      pushToast?.("Settings saved locally.", "success");
    } catch {
      pushToast?.("Could not save settings.", "error");
    }
  }

  return (
    <div className="detail-page">
      <Link to="/" className="back-link">
        ← Back to dashboard
      </Link>
      <h2 className="detail-title">Settings</h2>

      <div className="card-block">
        <h3 className="section-title">Alert thresholds</h3>
        <p className="recent-meta">
          Configure when a battery should be treated as Low / Warning /
          Replace.
        </p>

        <form onSubmit={handleSave} className="settings-form">
          <label className="field">
            <span>Low voltage threshold (V)</span>
            <input
              type="number"
              step="0.01"
              name="voltage_low"
              value={thresholds.voltage_low}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span>Failure CCA ratio (measured / rated)</span>
            <input
              type="number"
              step="0.01"
              name="cca_low_ratio"
              value={thresholds.cca_low_ratio}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span>Warning CCA ratio (measured / rated)</span>
            <input
              type="number"
              step="0.01"
              name="warning_ratio"
              value={thresholds.warning_ratio}
              onChange={handleChange}
            />
          </label>

          {/* Extra sensor thresholds */}
          <label className="field">
            <span>High temperature threshold (°C)</span>
            <input
              type="number"
              step="0.5"
              name="high_temp"
              value={thresholds.high_temp}
              onChange={handleChange}
            />
          </label>

          <label className="field">
            <span>High vibration threshold</span>
            <input
              type="number"
              step="0.1"
              name="high_vibration"
              value={thresholds.high_vibration}
              onChange={handleChange}
            />
          </label>

          {/* Alert & dashboard preferences */}
          <label className="field">
            <span>Default severity filter (Alerts page)</span>
            <select
              name="default_severity"
              value={thresholds.default_severity}
              onChange={handleChange}
            >
              <option value="All">All</option>
              <option value="Warning">Warning</option>
              <option value="Failure">Failure</option>
              <option value="Replace">Replace</option>
            </select>
          </label>

          <label className="field">
            <span>Dashboard auto-refresh interval</span>
            <select
              name="refresh_interval"
              value={thresholds.refresh_interval}
              onChange={handleChange}
            >
              <option value={0}>Off</option>
              <option value={5000}>5 seconds</option>
              <option value={10000}>10 seconds</option>
              <option value={30000}>30 seconds</option>
            </select>
          </label>

          <button type="submit" className="btn-primary">
            Save settings
          </button>
          {saved && (
            <span className="settings-saved">
              Saved (local only, in this browser)
            </span>
          )}
          {thresholds.savedAt && (
            <span className="recent-meta">
              Last saved: {thresholds.savedAt}
            </span>
          )}
        </form>
      </div>
    </div>
  );
}



/* ---------------- Dashboard data hook ---------------- */

function useDashboardData() {
  const [stats, setStats] = useState({
    totalMachines: 0,
    healthy: 0,
    warning: 0,
    failure: 0,
    alertsToday: 0,
    voltageBuckets: [],
    labelBuckets: [],
  });
  const [recentReadings, setRecentReadings] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("offline");
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:5000/summary");
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();

      setStats({
        totalMachines: data.total_machines ?? 0,
        healthy: data.healthy ?? 0,
        warning: data.warning ?? 0,
        failure: data.failure ?? 0,
        alertsToday: data.alerts_today ?? 0,
        voltageBuckets: data.voltage_buckets ?? [],
        labelBuckets: data.label_buckets ?? [],
      });
      setRecentReadings(data.recent_readings ?? []);
      setConnectionStatus("connected");
    } catch {
      setConnectionStatus("offline");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, []);

  return { stats, recentReadings, connectionStatus, loading, refresh: fetchAll };
}

/* ---------------- App shell + routes ---------------- */

function AppShell() {
  const location = useLocation();
  const { stats, recentReadings, connectionStatus, loading, refresh } =
    useDashboardData();
  const [toast, setToast] = useState(null);

  function pushToast(message, type = "info") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  const isActive = (to) =>
    to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(to);

  function toggleTheme() {
    const body = document.body;
    const current = body.getAttribute("data-theme") || "light";
    body.setAttribute("data-theme", current === "dark" ? "light" : "dark");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          <a href="/" className="app-title-link">
            <h1 className="app-title">Smart Battery Health Dashboard</h1>
          </a>
          <p className="app-subtitle">Predictive Maintenance for Manufacturing Fleets</p>
          <nav className="app-nav">
            <Link
              to="/"
              className={classNames(
                "nav-link",
                isActive("/") && "filter-chip-active"
              )}
            >
              Overview
            </Link>
            <Link
              to="/recent"
              className={classNames(
                "nav-link",
                isActive("/recent") && "filter-chip-active"
              )}
            >
              Recent
            </Link>
            <Link
              to="/alerts"
              className={classNames(
                "nav-link",
                isActive("/alerts") && "filter-chip-active"
              )}
            >
              Alerts
            </Link>
            <Link
              to="/locations"
              className={classNames(
                "nav-link",
                isActive("/locations") && "filter-chip-active"
              )}
            >
              Locations
            </Link>
            <Link
              to="/insights"
              className={classNames(
                "nav-link",
                isActive("/insights") && "filter-chip-active"
              )}
            >
              Model insights
            </Link>
            <Link
              to="/settings"
              className={classNames(
                "nav-link",
                isActive("/settings") && "filter-chip-active"
              )}
            >
              Settings
            </Link>
          </nav>
        </div>

        <div className="app-header-right">
          <div className="connection-status">
            <span className="status-text">Status</span>
            <ConnectionPill status={connectionStatus} />
          </div>
          <button type="button" className="theme-toggle" onClick={toggleTheme}>
            <div className="theme-toggle-thumb" />
          </button>
          <button
            type="button"
            className="btn-print"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="toast-container">
          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>

        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                connectionStatus={connectionStatus}
                stats={stats}
                loading={loading}
                onRefresh={refresh}
              />
            }
          />
          <Route
            path="/recent"
            element={<RecentTablePage recentReadings={recentReadings} />}
          />
          <Route
            path="/alerts"
            element={<AlertsFromRecentPage recentReadings={recentReadings} />}
          />
          <Route path="/locations" element={<LocationsBySitePage />} />
          <Route path="/insights" element={<ModelInsightsPage />} />
          <Route
            path="/settings"
            element={<SettingsPage pushToast={pushToast} />}
          />
          <Route
            path="/machines/:machineId"
            element={<MachineDetailPage pushToast={pushToast} />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

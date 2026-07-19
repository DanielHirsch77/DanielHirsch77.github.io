const DATA_URL = "status.json";
const REFRESH_MS = 5 * 60 * 1000;
const REFRESH_SECONDS = REFRESH_MS / 1000;

const els = {
  overallPill: document.getElementById("overall-pill"),
  updatedAt: document.getElementById("updated-at"),
  refreshIn: document.getElementById("refresh-in"),
  ibGatewayState: document.getElementById("ib-gateway-state"),
  ibGatewayDetail: document.getElementById("ib-gateway-detail"),
  healthMonitorState: document.getElementById("health-monitor-state"),
  healthMonitorDetail: document.getElementById("health-monitor-detail"),
  signalRunnerState: document.getElementById("signal-runner-state"),
  signalRunnerDetail: document.getElementById("signal-runner-detail"),
  dayTradingState: document.getElementById("day-trading-state"),
  dayTradingDetail: document.getElementById("day-trading-detail"),
  serviceCount: document.getElementById("service-count"),
  serviceList: document.getElementById("service-list"),
  ibPortState: document.getElementById("ib-port-state"),
  ibPortDetail: document.getElementById("ib-port-detail"),
  aggregatorState: document.getElementById("aggregator-state"),
  aggregatorDetail: document.getElementById("aggregator-detail"),
  disabledState: document.getElementById("disabled-state"),
  disabledDetail: document.getElementById("disabled-detail"),
  snapshotJson: document.getElementById("snapshot-json"),
};

let latestSnapshot = null;
let secondsUntilRefresh = REFRESH_SECONDS;

function setStatusLabel(el, text, kind) {
  el.textContent = text;
  el.className = `service-status ${kind}`;
}

function formatTime(value) {
  if (!value) return "--";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function summarize(snapshot) {
  const services = snapshot.services || [];
  const active = services.filter((s) => s.enabled).length;
  const running = services.filter((s) => s.enabled && s.running).length;
  const disabled = services.filter((s) => !s.enabled).length;

  const gatewayOk = snapshot.ib_gateway?.reachable;
  const monitorOk = snapshot.health_monitor?.running;
  const aggregatorOk = snapshot.signal_aggregator?.running;
  const allEnabledUp = active === running;
  const healthy = gatewayOk && monitorOk && aggregatorOk && allEnabledUp;

  if (healthy) {
    els.overallPill.textContent = "All systems green";
    els.overallPill.style.color = "var(--good)";
    els.overallPill.style.borderColor = "rgba(51, 209, 122, 0.28)";
  } else {
    els.overallPill.textContent = "Degraded";
    els.overallPill.style.color = "var(--warn)";
    els.overallPill.style.borderColor = "rgba(242, 193, 78, 0.28)";
  }

  els.updatedAt.textContent = formatTime(snapshot.generated_at);
  els.ibGatewayState.textContent = gatewayOk ? "Online" : "Offline";
  els.ibGatewayDetail.textContent = `${snapshot.ib_gateway?.host || "127.0.0.1"}:${snapshot.ib_gateway?.port || 4002}`;
  els.healthMonitorState.textContent = monitorOk ? "Running" : "Stopped";
  els.healthMonitorDetail.textContent = `PID ${snapshot.health_monitor?.pid || "--"}`;
  els.signalRunnerState.textContent = aggregatorOk ? "Running" : "Stopped";
  els.signalRunnerDetail.textContent = `signal-aggregator PID ${snapshot.signal_aggregator?.pid || "--"}`;
  els.dayTradingState.textContent = `${running}/${active} running`;
  els.dayTradingDetail.textContent = `${disabled} disabled, ${services.length - active - disabled} stopped`;
  els.serviceCount.textContent = `${services.length} services`;

  els.ibPortState.textContent = gatewayOk ? "Reachable" : "Down";
  els.ibPortDetail.textContent = `127.0.0.1:${snapshot.ib_gateway?.port || 4002}`;
  els.aggregatorState.textContent = aggregatorOk ? "Running" : "Stopped";
  els.aggregatorDetail.textContent = `PID ${snapshot.signal_aggregator?.pid || "--"}`;
  els.disabledState.textContent = String(disabled);
  els.disabledDetail.textContent = snapshot.disabled_services?.join(", ") || "None";

  els.serviceList.innerHTML = services.map((service) => {
    const stateClass = service.enabled
      ? (service.running ? "state-up" : "state-down")
      : "state-disabled";
    const stateText = service.enabled
      ? (service.running ? `running${service.pid ? ` (PID ${service.pid})` : ""}` : "stopped")
      : `disabled${service.pid ? ` (PID ${service.pid})` : ""}`;
    const detail = service.enabled
      ? (service.running ? service.detail || "Live" : service.detail || "Not running")
      : service.detail || "Disabled in config";

    return `
      <article class="service-row">
        <div>
          <div class="service-name">${service.name}</div>
          <div class="subtle">${detail}</div>
        </div>
        <div class="service-status ${stateClass}">${stateText}</div>
      </article>
    `;
  }).join("");

  els.snapshotJson.textContent = JSON.stringify(snapshot, null, 2);
}

async function loadStatus() {
  try {
    const res = await fetch(`${DATA_URL}?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    latestSnapshot = await res.json();
    summarize(latestSnapshot);
  } catch (error) {
    els.overallPill.textContent = "Snapshot unavailable";
    els.overallPill.style.color = "var(--bad)";
    els.overallPill.style.borderColor = "rgba(255, 107, 107, 0.28)";
    els.snapshotJson.textContent = JSON.stringify({
      error: String(error),
      note: "status.json could not be loaded",
    }, null, 2);
  }
}

function tick() {
  secondsUntilRefresh -= 1;
  if (secondsUntilRefresh <= 0) {
    secondsUntilRefresh = REFRESH_SECONDS;
    loadStatus();
  }
  const mins = Math.floor(secondsUntilRefresh / 60);
  const secs = String(secondsUntilRefresh % 60).padStart(2, "0");
  els.refreshIn.textContent = `${mins}:${secs}`;
}

loadStatus();
setInterval(tick, 1000);

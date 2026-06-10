const state = {
  all: [],
  filtered: [],
  charts: {},
  loading: false,
};

const GOOGLE_SHEET_GVIZ_URL = "https://docs.google.com/spreadsheets/d/1OXqXeJOOkmg8JIm-lTt3cBZS1sox-JJ3aQkuJ7qUjpY/gviz/tq";
const GOOGLE_SHEET_GID = "1684298607";
const GOOGLE_SHEET_QUERY = "select B,C,D,E,F,G,H,I,J,K,L,M,O,Q,R";
const colors = ["#0f3a5e", "#2f80ed", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#4f46e5"];

const $ = (id) => document.getElementById(id);
const money = (v) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v);
const number = (v) => new Intl.NumberFormat("en-US").format(Math.round(v || 0));
const pct = (v) => `${((v || 0) * 100).toFixed(1)}%`;

function hydrate(payload) {
  return payload.rows.map((row) => Object.fromEntries(payload.fields.map((field, i) => [field, row[i]])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function toNumber(value) {
  const cleaned = String(value ?? "").trim().replaceAll(",", "").replace("(", "-").replace(")", "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || "(blank)";
}

function rowsFromGoogleCsv(csvText) {
  const csvRows = parseCsv(csvText);
  const body = csvRows.slice(1).filter((row) => row.length > 5);
  return body.map((row) => {
    const year = toNumber(row[10]);
    const month = toNumber(row[11]);
    return {
      customer: cleanText(row[1]),
      productNo: cleanText(row[2]),
      productName: cleanText(row[3]),
      seasonYear: cleanText(row[4]),
      category: cleanText(row[5]),
      country: cleanText(row[6]),
      channel: cleanText(row[7]),
      brand: cleanText(row[8]),
      date: cleanText(row[9]),
      year,
      month,
      qty: toNumber(row[12]),
      currency: cleanText(row[14]),
      amount: toNumber(row[16]),
      transfer: cleanText(row[17]),
      period: `${year}-${String(month).padStart(2, "0")}`,
    };
  });
}

async function loadLiveRows() {
  return loadGvizJsonp();
}

function cellValue(cells, index) {
  const cell = cells[index] || {};
  if (cell.v === null || cell.v === undefined) return "";
  return cell.f ?? cell.v;
}

function rowsFromGviz(payload) {
  if (payload.status !== "ok") throw new Error(`Google Sheet query failed: ${payload.status}`);
  return payload.table.rows.map((item) => {
    const cells = item.c || [];
    const year = toNumber(cellValue(cells, 9));
    const month = toNumber(cellValue(cells, 10));
    return {
      customer: cleanText(cellValue(cells, 0)),
      productNo: cleanText(cellValue(cells, 1)),
      productName: cleanText(cellValue(cells, 2)),
      seasonYear: cleanText(cellValue(cells, 3)),
      category: cleanText(cellValue(cells, 4)),
      country: cleanText(cellValue(cells, 5)),
      channel: cleanText(cellValue(cells, 6)),
      brand: cleanText(cellValue(cells, 7)),
      date: cleanText(cellValue(cells, 8)),
      year,
      month,
      qty: toNumber(cellValue(cells, 11)),
      currency: cleanText(cellValue(cells, 12)),
      amount: toNumber(cellValue(cells, 13)),
      transfer: cleanText(cellValue(cells, 14)),
      period: `${year}-${String(month).padStart(2, "0")}`,
    };
  });
}

function loadGvizJsonp() {
  return new Promise((resolve, reject) => {
    const callbackName = `__googleSheetDashboard_${Date.now()}_${Math.round(Math.random() * 100000)}`;
    const params = new URLSearchParams({
      gid: GOOGLE_SHEET_GID,
      tq: GOOGLE_SHEET_QUERY,
      tqx: `out:json;responseHandler:${callbackName}`,
      cacheBust: String(Date.now()),
    });
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Google Sheet live load timed out."));
    }, 90000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      try {
        const rows = rowsFromGviz(payload);
        cleanup();
        resolve(rows);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Google Sheet live script failed to load."));
    };
    script.src = `${GOOGLE_SHEET_GVIZ_URL}?${params.toString()}`;
    document.head.appendChild(script);
  });
}

function loadFallbackRows() {
  if (window.DASHBOARD_PAYLOAD) return hydrate(window.DASHBOARD_PAYLOAD);
  throw new Error("No fallback data found.");
}

function sum(rows, key) {
  return rows.reduce((acc, row) => acc + Number(row[key] || 0), 0);
}

function uniqueCount(rows, key) {
  return new Set(rows.map((row) => row[key]).filter(Boolean)).size;
}

function groupBy(rows, key) {
  const map = new Map();
  rows.forEach((row) => {
    const label = row[key] || "(blank)";
    const item = map.get(label) || { label, amount: 0, qty: 0, rows: 0 };
    item.amount += Number(row.amount || 0);
    item.qty += Number(row.qty || 0);
    item.rows += 1;
    map.set(label, item);
  });
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function groupProduct(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.productNo}|${row.productName}|${row.brand}`;
    const item = map.get(key) || {
      productNo: row.productNo,
      productName: row.productName,
      brand: row.brand,
      amount: 0,
      qty: 0,
    };
    item.amount += Number(row.amount || 0);
    item.qty += Number(row.qty || 0);
    map.set(key, item);
  });
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

function populateSelect(id, values, label = "All") {
  const select = $(id);
  select.innerHTML = `<option value="">${label}</option>` + values.map((value) => `<option value="${escapeAttr(value)}">${value}</option>`).join("");
}

function escapeAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function filterRows() {
  const period = $("periodFilter").value;
  const brand = $("brandFilter").value;
  const category = $("categoryFilter").value;
  const channel = $("channelFilter").value;
  const country = $("countryFilter").value;
  const transfer = $("transferFilter").value;
  const query = $("searchInput").value.trim().toLowerCase();

  state.filtered = state.all.filter((row) => {
    if (period && row.period !== period) return false;
    if (brand && row.brand !== brand) return false;
    if (category && row.category !== category) return false;
    if (channel && row.channel !== channel) return false;
    if (country && row.country !== country) return false;
    if (transfer && row.transfer !== transfer) return false;
    if (query) {
      const haystack = `${row.customer} ${row.productNo} ${row.productName} ${row.brand}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function chart(id, type, config) {
  if (state.charts[id]) state.charts[id].destroy();
  state.charts[id] = new Chart($(id), {
    type,
    data: config.data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      plugins: {
        legend: { display: config.legend ?? false, position: "bottom", labels: { boxWidth: 10, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const value = Array.isArray(ctx.parsed) ? ctx.parsed[0] : ctx.parsed.y ?? ctx.parsed.x ?? ctx.raw;
              return `${ctx.dataset.label || ctx.label}: ${number(value)}`;
            },
          },
        },
      },
      scales: config.scales || {},
      indexAxis: config.indexAxis,
    },
  });
}

function renderKpis(rows) {
  const totalAmount = sum(rows, "amount");
  const totalQty = sum(rows, "qty");
  const topBrand = groupBy(rows, "brand")[0];

  $("heroSales").textContent = `NT$${money(totalAmount)}`;
  $("heroNote").textContent = `${number(rows.length)} filtered rows from ${number(state.all.length)} total source rows.`;
  $("rowCount").textContent = number(rows.length);
  $("totalQty").textContent = number(totalQty);
  $("avgOrder").textContent = rows.length ? `NT$${money(totalAmount / rows.length)}` : "NT$0";
  $("customerCount").textContent = number(uniqueCount(rows, "customer"));
  $("brandCount").textContent = number(uniqueCount(rows, "brand"));
  $("productCount").textContent = number(uniqueCount(rows, "productNo"));
  $("topShare").textContent = topBrand && totalAmount ? pct(topBrand.amount / totalAmount) : "0.0%";
  $("topShareLabel").textContent = topBrand ? `${topBrand.label} brand share` : "largest brand share";
}

function renderCharts(rows) {
  const periods = groupBy(rows, "period").sort((a, b) => a.label.localeCompare(b.label));
  chart("trendChart", "line", {
    legend: true,
    data: {
      labels: periods.map((d) => d.label),
      datasets: [
        { label: "NTD Sales", data: periods.map((d) => d.amount), borderColor: colors[0], backgroundColor: "rgba(15,58,94,.12)", tension: .35, fill: true, yAxisID: "y" },
        { label: "Qty", data: periods.map((d) => d.qty), borderColor: colors[2], backgroundColor: colors[2], tension: .35, yAxisID: "y1" },
      ],
    },
    scales: {
      y: { ticks: { callback: money }, grid: { color: "#eef2f7" } },
      y1: { position: "right", ticks: { callback: money }, grid: { display: false } },
      x: { grid: { display: false } },
    },
  });

  const categories = groupBy(rows, "channel").slice(0, 8);
  chart("categoryChart", "doughnut", {
    legend: true,
    data: {
      labels: categories.map((d) => d.label),
      datasets: [{ data: categories.map((d) => d.amount), backgroundColor: colors, borderWidth: 2, borderColor: "#fff" }],
    },
  });

  const brands = groupBy(rows, "brand").slice(0, 10).reverse();
  chart("brandChart", "bar", {
    indexAxis: "y",
    data: {
      labels: brands.map((d) => d.label),
      datasets: [{ label: "NTD Sales", data: brands.map((d) => d.amount), backgroundColor: "#2f80ed", borderRadius: 4 }],
    },
    scales: {
      x: { ticks: { callback: money }, grid: { color: "#eef2f7" } },
      y: { grid: { display: false } },
    },
  });

  const channels = groupBy(rows, "channel").slice(0, 8);
  chart("channelChart", "bar", {
    data: {
      labels: channels.map((d) => d.label),
      datasets: [{ label: "NTD Sales", data: channels.map((d) => d.amount), backgroundColor: "#0f3a5e", borderRadius: 4 }],
    },
    scales: {
      y: { ticks: { callback: money }, grid: { color: "#eef2f7" } },
      x: { grid: { display: false } },
    },
  });
}

function renderRank(rows) {
  const customers = groupBy(rows, "customer").slice(0, 10);
  const max = Math.max(...customers.map((d) => d.amount), 1);
  $("customerRank").innerHTML = customers.map((d, i) => `
    <div class="rankItem">
      <div class="rankNo">${i + 1}</div>
      <div class="rankName">
        <strong title="${escapeAttr(d.label)}">${d.label}</strong>
        <div class="bar"><span style="width:${Math.max(4, d.amount / max * 100)}%"></span></div>
      </div>
      <div class="rankVal">NT$${money(d.amount)}</div>
    </div>
  `).join("");
}

function renderTables(rows) {
  const products = groupProduct(rows).slice(0, 12);
  $("productRows").innerHTML = products.map((row) => `
    <tr>
      <td><strong>${row.productNo}</strong><br><span>${row.productName}</span></td>
      <td>${row.brand}</td>
      <td class="num">NT$${money(row.amount)}</td>
      <td class="num">${number(row.qty)}</td>
    </tr>
  `).join("");

  const detail = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 150);
  $("detailRows").innerHTML = detail.map((row) => `
    <tr>
      <td>${row.period}</td>
      <td>${row.customer}</td>
      <td>${row.brand}</td>
      <td>${row.category}</td>
      <td>${row.country}</td>
      <td>${row.channel}</td>
      <td>${row.transfer}</td>
      <td><strong>${row.productNo}</strong><br><span>${row.productName}</span></td>
      <td class="num">${number(row.qty)}</td>
      <td class="num">NT$${money(row.amount)}</td>
    </tr>
  `).join("");
  $("detailNote").textContent = `showing ${number(detail.length)} rows from ${number(rows.length)} filtered rows`;
}

function render() {
  filterRows();
  renderKpis(state.filtered);
  renderCharts(state.filtered);
  renderRank(state.filtered);
  renderTables(state.filtered);
}

function setupFilters() {
  const selected = {
    period: $("periodFilter").value,
    brand: $("brandFilter").value,
    category: $("categoryFilter").value,
    channel: $("channelFilter").value,
    country: $("countryFilter").value,
    transfer: $("transferFilter").value,
  };
  populateSelect("periodFilter", [...new Set(state.all.map((d) => d.period))].sort(), "All Periods");
  populateSelect("brandFilter", groupBy(state.all, "brand").map((d) => d.label), "All Brands");
  populateSelect("categoryFilter", groupBy(state.all, "category").map((d) => d.label), "All Categories");
  populateSelect("channelFilter", groupBy(state.all, "channel").map((d) => d.label), "All Channels");
  populateSelect("countryFilter", groupBy(state.all, "country").map((d) => d.label), "All Countries");
  populateSelect("transferFilter", groupBy(state.all, "transfer").map((d) => d.label), "All Transfers");
  $("periodFilter").value = selected.period;
  $("brandFilter").value = selected.brand;
  $("categoryFilter").value = selected.category;
  $("channelFilter").value = selected.channel;
  $("countryFilter").value = selected.country;
  $("transferFilter").value = selected.transfer;
}

function setRows(rows, sourceLabel) {
  state.all = rows;
  state.filtered = rows;
  setupFilters();
  $("statusText").textContent = `${number(rows.length)} rows loaded from ${sourceLabel}`;
  render();
}

async function refreshLiveData() {
  if (state.loading) return;
  state.loading = true;
  $("refreshBtn").disabled = true;
  $("statusText").textContent = "Refreshing Google Sheet";
  try {
    const rows = await loadLiveRows();
    setRows(rows, "Google Sheet");
  } catch (error) {
    console.error(error);
    if (!state.all.length) {
      setRows(loadFallbackRows(), "local backup");
      $("statusText").textContent = `${number(state.all.length)} rows loaded from local backup`;
    } else {
      $("statusText").textContent = `Live refresh failed. Showing ${number(state.all.length)} cached rows`;
    }
  } finally {
    state.loading = false;
    $("refreshBtn").disabled = false;
  }
}

function exportCsv() {
  const headers = ["period", "customer", "brand", "category", "country", "channel", "transfer", "productNo", "productName", "qty", "amount"];
  const lines = [headers.join(",")].concat(
    state.filtered.map((row) => headers.map((h) => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(","))
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "filtered_sales_dashboard.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function init() {
  ["periodFilter", "brandFilter", "categoryFilter", "channelFilter", "countryFilter", "transferFilter"].forEach((id) => $(id).addEventListener("change", render));
  $("searchInput").addEventListener("input", () => window.requestAnimationFrame(render));
  $("resetBtn").addEventListener("click", () => {
    ["periodFilter", "brandFilter", "categoryFilter", "channelFilter", "countryFilter", "transferFilter"].forEach((id) => { $(id).value = ""; });
    $("searchInput").value = "";
    render();
  });
  $("refreshBtn").addEventListener("click", refreshLiveData);
  $("downloadBtn").addEventListener("click", exportCsv);

  await refreshLiveData();
  window.setInterval(refreshLiveData, 5 * 60 * 1000);
}

init().catch((error) => {
  console.error(error);
  $("statusText").textContent = "Data load failed";
});

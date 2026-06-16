(function () {
  const PRIOR_GID = "1573568113";
  const QUERY = "select B,C,D,E,F,G,H,I,J,K,L,M,O,Q,R";
  let priorRows = [];

  function clean(value) {
    const text = String(value ?? "").trim();
    return text || "(blank)";
  }

  function toNumber(value) {
    const cleaned = String(value ?? "").trim().replaceAll(",", "").replace("(", "-").replace(")", "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function cell(cells, index) {
    const item = cells[index] || {};
    if (item.v === null || item.v === undefined) return "";
    return item.f ?? item.v;
  }

  function rowsFromPayload(payload) {
    return payload.table.rows.map((item) => {
      const cells = item.c || [];
      const year = toNumber(cell(cells, 9));
      const month = toNumber(cell(cells, 10));
      return {
        customer: clean(cell(cells, 0)),
        productNo: clean(cell(cells, 1)),
        productName: clean(cell(cells, 2)),
        seasonYear: clean(cell(cells, 3)),
        category: clean(cell(cells, 4)),
        country: clean(cell(cells, 5)),
        channel: clean(cell(cells, 6)),
        brand: clean(cell(cells, 7)),
        date: clean(cell(cells, 8)),
        year,
        month,
        qty: toNumber(cell(cells, 11)),
        currency: clean(cell(cells, 12)),
        amount: toNumber(cell(cells, 13)),
        transfer: clean(cell(cells, 14)),
        period: `${year}-${String(month).padStart(2, "0")}`,
      };
    });
  }

  function loadPriorRows() {
    return new Promise((resolve, reject) => {
      const callbackName = `__yoyPrior_${Date.now()}_${Math.round(Math.random() * 100000)}`;
      const params = new URLSearchParams({ gid: PRIOR_GID, tq: QUERY, tqx: `out:json;responseHandler:${callbackName}`, cacheBust: String(Date.now()) });
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error("Prior-year sheet load timed out.")); }, 90000);
      function cleanup() { window.clearTimeout(timeout); delete window[callbackName]; script.remove(); }
      window[callbackName] = (payload) => { try { const rows = rowsFromPayload(payload); cleanup(); resolve(rows); } catch (error) { cleanup(); reject(error); } };
      script.onerror = () => { cleanup(); reject(new Error("Prior-year sheet script failed to load.")); };
      script.src = `${GOOGLE_SHEET_GVIZ_URL}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function filteredCurrentRows() { filterRows(); return state.filtered; }

  function filteredPriorRows() {
    const period = $("periodFilter").value;
    const brand = $("brandFilter").value;
    const category = $("categoryFilter").value;
    const channel = $("channelFilter").value;
    const country = $("countryFilter").value;
    const transfer = $("transferFilter").value;
    const query = $("searchInput").value.trim().toLowerCase();
    const selectedMonth = period ? Number(period.split("-")[1]) : null;
    return priorRows.filter((row) => {
      if (selectedMonth && row.month !== selectedMonth) return false;
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

  function renderYoyAnalysis() {
    if (!priorRows.length || !state.all.length) return;
    const currentRows = filteredCurrentRows();
    const priorFiltered = filteredPriorRows();
    const selectedPeriod = $("periodFilter").value;
    const currentMonths = new Set(currentRows.map((row) => row.month).filter(Boolean));
    const comparableMonths = selectedPeriod ? new Set([Number(selectedPeriod.split("-")[1])]) : currentMonths;
    const priorComparable = priorFiltered.filter((row) => comparableMonths.has(row.month));
    const currentAmount = sum(currentRows, "amount");
    const priorAmount = sum(priorComparable, "amount");
    const delta = currentAmount - priorAmount;
    const growth = priorAmount ? delta / priorAmount : null;

    $("yoyCurrent").textContent = `NT$${money(currentAmount)}`;
    $("yoyPrior").textContent = `NT$${money(priorAmount)}`;
    $("yoyGrowth").textContent = growth === null ? "N/A" : `${(growth * 100).toFixed(1)}%`;
    $("yoyGrowth").className = growth === null ? "" : growth >= 0 ? "good" : "bad";
    $("yoyDelta").textContent = `${delta >= 0 ? "+" : "-"}NT$${money(Math.abs(delta))}`;
    $("yoyDelta").className = delta >= 0 ? "good" : "bad";
    $("yoyNote").textContent = `comparing ${comparableMonths.size || 0} month(s), filtered rows: ${number(currentRows.length)} current / ${number(priorComparable.length)} last year`;

    const monthLabels = Array.from({ length: 12 }, (_, index) => index + 1);
    const currentByMonth = new Map(groupBy(currentRows, "month").map((item) => [Number(item.label), item.amount]));
    const priorByMonth = new Map(groupBy(priorFiltered, "month").map((item) => [Number(item.label), item.amount]));
    chart("yoyChart", "bar", {
      legend: true,
      data: {
        labels: monthLabels.map((month) => `M${month}`),
        datasets: [
          { label: "Current Sales", data: monthLabels.map((month) => currentByMonth.get(month) || 0), backgroundColor: "#2f80ed", borderRadius: 4 },
          { label: "Last Year Sales", data: monthLabels.map((month) => priorByMonth.get(month) || 0), backgroundColor: "#94a3b8", borderRadius: 4 },
        ],
      },
      scales: { y: { ticks: { callback: money }, grid: { color: "#eef2f7" } }, x: { grid: { display: false } } },
    });
  }

  const filters = ["periodFilter", "brandFilter", "categoryFilter", "channelFilter", "countryFilter", "transferFilter"];
  filters.forEach((id) => $(id).addEventListener("change", () => window.setTimeout(renderYoyAnalysis, 0)));
  $("searchInput").addEventListener("input", () => window.requestAnimationFrame(renderYoyAnalysis));
  $("refreshBtn").addEventListener("click", () => { loadPriorRows().then((rows) => { priorRows = rows; renderYoyAnalysis(); }).catch(console.error); });
  loadPriorRows().then((rows) => {
    priorRows = rows;
    const waitForCurrent = window.setInterval(() => {
      if (!state.all.length) return;
      window.clearInterval(waitForCurrent);
      renderYoyAnalysis();
    }, 250);
  }).catch((error) => { console.error(error); $("yoyNote").textContent = "last year data failed to load"; });
})();

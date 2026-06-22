(function () {
  const PRIOR_GID = "1573568113";
  const QUERY = "select B,C,D,E,F,G,H,I,J,K,L,M,O,Q,R";
  const TOP_CUSTOMER_LIMIT = 20;
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
        category: clean(cell(cells, 4)),
        country: clean(cell(cells, 5)),
        channel: clean(cell(cells, 6)),
        brand: clean(cell(cells, 7)),
        year,
        month,
        qty: toNumber(cell(cells, 11)),
        amount: toNumber(cell(cells, 13)),
        transfer: clean(cell(cells, 14)),
      };
    });
  }

  function loadPriorRows() {
    return new Promise((resolve, reject) => {
      const callbackName = `__customerYoyPrior_${Date.now()}_${Math.round(Math.random() * 100000)}`;
      const params = new URLSearchParams({
        gid: PRIOR_GID,
        tq: QUERY,
        tqx: `out:json;responseHandler:${callbackName}`,
        cacheBust: String(Date.now()),
      });
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Top Customers YoY prior-year load timed out."));
      }, 90000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (payload) => {
        try {
          const rows = rowsFromPayload(payload);
          cleanup();
          resolve(rows);
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Top Customers YoY prior-year script failed to load."));
      };
      script.src = `${GOOGLE_SHEET_GVIZ_URL}?${params.toString()}`;
      document.head.appendChild(script);
    });
  }

  function comparablePriorRows(currentRows, priorRows) {
    const selectedPeriod = $("periodFilter").value;
    const months = selectedPeriod
      ? new Set([Number(selectedPeriod.split("-")[1])])
      : new Set(currentRows.map((row) => row.month).filter(Boolean));
    return priorRows.filter((row) => months.has(row.month));
  }

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

  function groupCustomers(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const label = row.customer || "(blank)";
      const item = map.get(label) || { label, amount: 0, qty: 0, rows: 0 };
      item.amount += Number(row.amount || 0);
      item.qty += Number(row.qty || 0);
      item.rows += 1;
      map.set(label, item);
    });
    return map;
  }

  function renderCustomerSummary(currentTotal, priorTotal, topCount) {
    const delta = currentTotal - priorTotal;
    const growth = priorTotal ? (delta / priorTotal) * 100 : null;
    $("customerYoySummary").innerHTML = `
      <div>
        <span>Current Top ${topCount}</span>
        <strong>NT$${money(currentTotal)}</strong>
      </div>
      <div>
        <span>Last Year Same Customers</span>
        <strong>NT$${money(priorTotal)}</strong>
      </div>
      <div>
        <span>YoY Growth</span>
        <strong class="yoyValue ${growth === null ? "" : growth >= 0 ? "good" : "bad"}">${growth === null ? "N/A" : `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}</strong>
      </div>
    `;
  }

  function rateClass(value) {
    if (value === null) return "neutral";
    return value >= 0 ? "good" : "bad";
  }

  function formatRate(value) {
    if (value === null) return "N/A";
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  }

  function renderTopCustomerYoy() {
    if (!$("customerYoyChart")) return;

    const currentRows = state.filtered || [];
    const priorSource = priorRows.length ? filteredPriorRows() : (state.priorFiltered || []);
    const priorComparableRows = comparablePriorRows(currentRows, priorSource);
    const currentByCustomer = groupCustomers(currentRows);
    const priorByCustomer = groupCustomers(priorComparableRows);
    const topCustomers = [...currentByCustomer.values()].sort((a, b) => b.amount - a.amount).slice(0, TOP_CUSTOMER_LIMIT);
    const labels = topCustomers.map((item) => item.label).reverse();
    const currentSales = topCustomers.map((item) => item.amount).reverse();
    const priorSales = topCustomers.map((item) => (priorByCustomer.get(item.label) || { amount: 0 }).amount).reverse();
    const growthRates = currentSales.map((amount, index) => (
      priorSales[index] ? ((amount - priorSales[index]) / priorSales[index]) * 100 : null
    ));

    renderCustomerSummary(
      currentSales.reduce((total, value) => total + value, 0),
      priorSales.reduce((total, value) => total + value, 0),
      topCustomers.length,
    );
    $("customerYoyNote").textContent = `ranked by current sales, compared with ${number(priorComparableRows.length)} last year rows`;
    $("customerYoyRates").innerHTML = growthRates.map((value) => `
      <div class="customerYoyRate ${rateClass(value)}">${formatRate(value)}</div>
    `).join("");
    $("customerYoyRates").style.gridTemplateRows = `repeat(${Math.max(topCustomers.length, 1)}, 1fr)`;

    chart("customerYoyChart", "bar", {
      indexAxis: "y",
      legend: true,
      data: {
        labels,
        datasets: [
          { label: "Current Sales", data: currentSales, backgroundColor: "#2f80ed", borderRadius: 4 },
          { label: "Last Year Sales", data: priorSales, backgroundColor: "#94a3b8", borderRadius: 4 },
        ],
      },
      scales: {
        x: { ticks: { callback: money }, grid: { color: "#eef2f7" } },
        y: { grid: { display: false } },
      },
    });
  }

  const originalRender = render;
  render = function (...args) {
    originalRender(...args);
    renderTopCustomerYoy();
  };

  loadPriorRows().then((rows) => {
    priorRows = rows;
    renderTopCustomerYoy();
  }).catch((error) => {
    console.error(error);
    $("customerYoyNote").textContent = "last year customer data failed to load";
  });
})();

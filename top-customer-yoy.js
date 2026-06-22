(function () {
  const TOP_CUSTOMER_LIMIT = 20;

  function comparablePriorRows(currentRows, priorRows) {
    const selectedPeriod = $("periodFilter").value;
    const months = selectedPeriod
      ? new Set([Number(selectedPeriod.split("-")[1])])
      : new Set(currentRows.map((row) => row.month).filter(Boolean));
    return priorRows.filter((row) => months.has(row.month));
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
    const priorRows = comparablePriorRows(currentRows, state.priorFiltered || []);
    const currentByCustomer = groupCustomers(currentRows);
    const priorByCustomer = groupCustomers(priorRows);
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
    $("customerYoyNote").textContent = `ranked by current sales, compared with ${number(priorRows.length)} last year rows`;
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
})();

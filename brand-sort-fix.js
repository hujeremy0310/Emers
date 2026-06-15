(function () {
  renderCharts = function (rows) {
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

    const brands = groupBy(rows, "brand").slice(0, 10);
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
  };

  if (state.all.length) render();
})();

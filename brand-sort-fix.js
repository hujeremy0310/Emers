(function () {
  const originalRender = render;

  render = function () {
    originalRender();
    const brandChart = Chart.getChart("brandChart");
    if (!brandChart) return;

    brandChart.options.scales.y.reverse = true;
    brandChart.options.scales.x.ticks.callback = (value) => `NT$${money(value)}`;
    brandChart.update();
  };

  if (state.all.length) render();
})();

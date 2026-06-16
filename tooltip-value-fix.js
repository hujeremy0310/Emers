(function () {
  function applyTooltipValueFix() {
    Object.values(state.charts).forEach((chartInstance) => {
      chartInstance.options.plugins.tooltip.callbacks.label = (context) => {
        const value = context.dataset.data[context.dataIndex] ?? 0;
        if (String(context.dataset.label || "").includes("%")) {
          return `${context.dataset.label || context.label}: ${Number(value).toFixed(1)}%`;
        }
        const prefix = String(context.dataset.label || "").includes("Sales") ? "NT$" : "";
        return `${context.dataset.label || context.label}: ${prefix}${money(value)}`;
      };
      chartInstance.update();
    });
  }

  const originalChart = chart;
  chart = function (...args) {
    originalChart(...args);
    applyTooltipValueFix();
  };

  if (state.all.length) applyTooltipValueFix();
})();

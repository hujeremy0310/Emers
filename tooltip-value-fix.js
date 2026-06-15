(function () {
  const originalRender = render;

  render = function () {
    originalRender();

    Object.values(state.charts).forEach((chartInstance) => {
      chartInstance.options.plugins.tooltip.callbacks.label = (context) => {
        const value = context.dataset.data[context.dataIndex] ?? 0;
        const prefix = String(context.dataset.label || "").includes("Sales") ? "NT$" : "";
        return `${context.dataset.label || context.label}: ${prefix}${money(value)}`;
      };
      chartInstance.update();
    });
  };

  if (state.all.length) render();
})();

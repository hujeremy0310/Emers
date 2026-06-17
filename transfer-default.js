(function () {
  const DEFAULT_TRANSFER = "N";

  function hasTransferOption() {
    const select = $("transferFilter");
    return [...select.options].some((option) => option.value === DEFAULT_TRANSFER);
  }

  function setDefaultTransfer() {
    const select = $("transferFilter");
    if (!select.value && hasTransferOption()) {
      select.value = DEFAULT_TRANSFER;
    }
  }

  const originalSetupFilters = setupFilters;
  setupFilters = function (...args) {
    originalSetupFilters(...args);
    setDefaultTransfer();
  };

  $("resetBtn").addEventListener("click", () => {
    window.requestAnimationFrame(() => {
      if (hasTransferOption()) {
        $("transferFilter").value = DEFAULT_TRANSFER;
        render();
      }
    });
  });
})();

/* Move the same dashboard into a mobile dialog; all inventory and progress stay shared. */
(function () {
  'use strict';
  const layout = document.querySelector('.game-layout');
  const dashboard = document.querySelector('.dashboard');
  const controls = document.querySelector('.touch-controls');
  const panel = document.getElementById('mobile-panel');
  const media = matchMedia('(max-width:650px), (max-width:950px) and (max-height:500px)');
  function updateLayout() {
    if (media.matches) panel.append(dashboard);
    else {
      if (panel.open) panel.close();
      layout.insertBefore(dashboard, controls);
    }
  }
  media.addEventListener('change', updateLayout);
  updateLayout();
})();

(function () {
  'use strict';

  var year = document.getElementById('copyright-year');
  if (year) year.textContent = String(new Date().getFullYear());

  if (window.NovelSite) {
    window.NovelSite.bindThemeButton(document.querySelector('[data-theme-button]'));
  }
})();

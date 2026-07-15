(function () {
  function detectLang() {
    var stored = localStorage.getItem('skidesk_site_lang');
    if (stored === 'sk' || stored === 'en') return stored;
    var nav = (navigator.language || '').toLowerCase();
    return nav.indexOf('sk') === 0 ? 'sk' : 'en';
  }
  function apply(lang) {
    document.documentElement.lang = lang;
    var dict = (window.SITE_I18N || {})[lang] || {};
    function get(path) {
      var parts = path.split('.');
      var cur = dict;
      for (var i = 0; i < parts.length; i++) {
        if (cur == null) return undefined;
        cur = cur[parts[i]];
      }
      return cur;
    }
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = get(el.getAttribute('data-i18n'));
      if (v !== undefined) el.innerHTML = v;
    });
    ['placeholder', 'title', 'alt'].forEach(function (attr) {
      document.querySelectorAll('[data-i18n-attr-' + attr + ']').forEach(function (el) {
        var v = get(el.getAttribute('data-i18n-attr-' + attr));
        if (v !== undefined) el.setAttribute(attr, v);
      });
    });
    document.querySelectorAll('[data-lang-btn]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang-btn') === lang);
    });
  }
  window.setSiteLang = function (lang) {
    localStorage.setItem('skidesk_site_lang', lang);
    apply(lang);
  };
  window.applySiteLang = function () {
    apply(detectLang());
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.applySiteLang);
  } else {
    window.applySiteLang();
  }
})();

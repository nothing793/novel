(function () {
  'use strict';

  var SOURCES = {
    outline: '道门/大纲.md',
    volumeOne: '道门/第一卷.md'
  };

  var KEYS = {
    fontScale: 'daomen:font-scale',
    progress: 'daomen:progress',
    theme: 'daomen:theme'
  };

  var volumePromise = null;
  var outlinePromise = null;

  function readStorage(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // 无痕模式或存储空间不足时，阅读功能仍然可用。
    }
  }

  function cleanProgress(value) {
    if (!value || typeof value !== 'object') return null;
    var chapterIndex = Number(value.chapterIndex);
    if (!Number.isInteger(chapterIndex) || chapterIndex < 0) return null;
    var scrollRatio = Number(value.scrollRatio);
    return {
      chapterIndex: chapterIndex,
      chapterLabel: typeof value.chapterLabel === 'string' ? value.chapterLabel : '',
      chapterName: typeof value.chapterName === 'string' ? value.chapterName : '',
      scrollRatio: Number.isFinite(scrollRatio) ? Math.min(1, Math.max(0, scrollRatio)) : 0,
      updatedAt: Number(value.updatedAt) || 0
    };
  }

  function getProgress() {
    var raw = readStorage(KEYS.progress, '');
    if (!raw) return null;
    try {
      return cleanProgress(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function saveProgress(progress) {
    var cleaned = cleanProgress(progress);
    if (!cleaned) return;
    cleaned.updatedAt = Date.now();
    writeStorage(KEYS.progress, JSON.stringify(cleaned));
  }

  function getTheme() {
    var theme = readStorage(KEYS.theme, 'paper');
    return theme === 'night' ? 'night' : 'paper';
  }

  function applyTheme(theme) {
    var next = theme === 'night' ? 'night' : 'paper';
    document.documentElement.dataset.theme = next;
    writeStorage(KEYS.theme, next);
    return next;
  }

  function toggleTheme() {
    return applyTheme(getTheme() === 'night' ? 'paper' : 'night');
  }

  function bindThemeButton(button) {
    if (!button) return;
    function paint() {
      var theme = getTheme();
      var isNight = theme === 'night';
      button.setAttribute('aria-label', isNight ? '切换到日间阅读' : '切换到夜间阅读');
      button.setAttribute('title', isNight ? '日间阅读' : '夜间阅读');
      button.dataset.themeState = theme;
      var text = button.querySelector('[data-theme-text]');
      if (text) text.textContent = isNight ? '日读' : '夜读';
      var icon = button.querySelector('[data-theme-icon]');
      if (icon) icon.textContent = isNight ? '☀' : '☾';
    }
    paint();
    button.addEventListener('click', function () {
      toggleTheme();
      paint();
    });
  }

  function getFontScale() {
    var scale = Number(readStorage(KEYS.fontScale, '19'));
    if (!Number.isFinite(scale)) return 19;
    return Math.min(24, Math.max(17, scale));
  }

  function setFontScale(scale) {
    var next = Math.min(24, Math.max(17, Number(scale) || 19));
    document.documentElement.style.setProperty('--reader-size', next + 'px');
    writeStorage(KEYS.fontScale, String(next));
    return next;
  }

  function readerUrl(chapterIndex, options) {
    var params = new URLSearchParams();
    params.set('chapter', String(chapterIndex + 1));
    if (options && options.resume) params.set('resume', '1');
    return 'reader.html?' + params.toString();
  }

  function fetchText(path) {
    if (window.location.protocol === 'file:') {
      return Promise.reject(new Error(
        '浏览器不允许本地文件直接读取手稿。请在项目目录运行 python3 -m http.server 8000，再访问 http://localhost:8000/'
      ));
    }

    var url = new URL(path, document.baseURI).toString();
    return fetch(url, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) {
        throw new Error('读取 ' + path + ' 失败（HTTP ' + response.status + '）');
      }
      return response.text();
    });
  }

  function loadVolume() {
    if (!volumePromise) {
      volumePromise = fetchText(SOURCES.volumeOne).then(function (markdown) {
        return window.NovelCore.splitChapters(markdown);
      });
    }
    return volumePromise;
  }

  function loadOutline() {
    if (!outlinePromise) {
      outlinePromise = fetchText(SOURCES.outline).then(function (markdown) {
        return window.NovelCore.parseOutline(markdown);
      });
    }
    return outlinePromise;
  }

  window.NovelSite = {
    KEYS: KEYS,
    SOURCES: SOURCES,
    applyTheme: applyTheme,
    bindThemeButton: bindThemeButton,
    getFontScale: getFontScale,
    getProgress: getProgress,
    getTheme: getTheme,
    loadOutline: loadOutline,
    loadVolume: loadVolume,
    readerUrl: readerUrl,
    saveProgress: saveProgress,
    setFontScale: setFontScale,
    toggleTheme: toggleTheme
  };
})();

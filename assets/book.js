(function () {
  'use strict';

  var Core = window.NovelCore;
  var Site = window.NovelSite;
  var chapterList = document.getElementById('chapter-list');
  var statChapters = document.getElementById('stat-chapters');
  var statWords = document.getElementById('stat-words');
  var continueLink = document.getElementById('continue-reading');
  var year = document.getElementById('copyright-year');

  if (year) year.textContent = String(new Date().getFullYear());
  Site.bindThemeButton(document.querySelector('[data-theme-button]'));

  function chapterLabel(chapter, index) {
    return chapter.label || '第' + (index + 1) + '章';
  }

  function showError(message) {
    if (!chapterList) return;
    var box = document.createElement('div');
    box.className = 'load-error';
    var title = document.createElement('strong');
    title.textContent = '正文暂时没有读到';
    var detail = document.createElement('p');
    detail.textContent = message;
    box.append(title, detail);
    chapterList.replaceChildren(box);
  }

  function renderChapters(chapters) {
    var progress = Site.getProgress();
    var fragment = document.createDocumentFragment();
    var totalChars = 0;

    chapters.forEach(function (chapter, index) {
      totalChars += chapter.charCount;

      var link = document.createElement('a');
      link.className = 'chapter-card';
      link.href = Site.readerUrl(index);
      link.setAttribute(
        'aria-label',
        chapterLabel(chapter, index) + ' ' + chapter.name
      );

      if (progress && progress.chapterIndex === index) {
        link.classList.add('is-current');
      }

      var number = document.createElement('span');
      number.className = 'chapter-index';
      number.textContent = String(index + 1).padStart(2, '0');

      var text = document.createElement('span');
      text.className = 'chapter-text';

      var label = document.createElement('span');
      label.className = 'chapter-label';
      label.textContent = chapterLabel(chapter, index);

      var name = document.createElement('span');
      name.className = 'chapter-name';
      name.textContent = chapter.name;

      var meta = document.createElement('span');
      meta.className = 'chapter-stats';
      meta.textContent =
        Core.formatCount(chapter.charCount) + ' · ' +
        Core.formatReadingTime(chapter.charCount);

      text.append(label, name, meta);

      var arrow = document.createElement('span');
      arrow.className = 'chapter-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';

      link.append(number, text, arrow);
      fragment.append(link);
    });

    chapterList.replaceChildren(fragment);

    if (statChapters) statChapters.textContent = chapters.length + ' 章';
    if (statWords) statWords.textContent = Core.formatCount(totalChars);

    if (progress && continueLink) {
      var current = chapters[progress.chapterIndex];
      if (current) {
        continueLink.hidden = false;
        continueLink.href = Site.readerUrl(progress.chapterIndex, { resume: true });
        continueLink.textContent = '继续阅读 · ' + chapterLabel(current, progress.chapterIndex);
      }
    }
  }

  Site.loadContent().then(renderChapters).catch(function (error) {
    showError(error && error.message ? error.message : '请确认手稿文件仍然存在。');
  });
})();

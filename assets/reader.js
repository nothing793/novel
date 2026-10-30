(function () {
  'use strict';

  var Core = window.NovelCore;
  var Site = window.NovelSite;

  var chapterTitle = document.getElementById('chapter-title');
  var chapterKicker = document.getElementById('chapter-kicker');
  var chapterMeta = document.getElementById('chapter-meta');
  var chapterContent = document.getElementById('chapter-content');
  var chapterSheet = document.getElementById('chapter-sheet');
  var chapterPager = document.getElementById('chapter-pager');
  var tocList = document.getElementById('toc-list');
  var tocMeta = document.getElementById('toc-meta');
  var tocPanel = document.getElementById('toc-panel');
  var tocToggle = document.getElementById('toc-toggle');
  var tocOverlay = document.getElementById('toc-overlay');
  var readerChapter = document.getElementById('reader-chapter');
  var progressBar = document.getElementById('reading-progress-bar');
  var backToTop = document.getElementById('back-to-top');
  var fontDecrease = document.getElementById('font-decrease');
  var fontIncrease = document.getElementById('font-increase');

  var chapters = [];
  var currentIndex = 0;
  var saveTimer = 0;
  var scrollTick = false;

  Site.bindThemeButton(document.querySelector('[data-theme-button]'));

  function labelFor(chapter, index) {
    return chapter.label || '第' + (index + 1) + '章';
  }

  function currentChapter() {
    return chapters[currentIndex];
  }

  function scrollRatio() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  function persistProgress() {
    var chapter = currentChapter();
    if (!chapter) return;
    Site.saveProgress({
      chapterIndex: currentIndex,
      chapterLabel: labelFor(chapter, currentIndex),
      chapterName: chapter.name,
      scrollRatio: scrollRatio()
    });
  }

  function updateScrollUI() {
    var ratio = scrollRatio();
    if (progressBar) progressBar.style.width = (ratio * 100).toFixed(2) + '%';
    if (backToTop) backToTop.hidden = window.scrollY < 720;
  }

  function scheduleProgressSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(persistProgress, 550);
  }

  function handleScroll() {
    if (!scrollTick) {
      scrollTick = true;
      window.requestAnimationFrame(function () {
        updateScrollUI();
        scrollTick = false;
      });
    }
    scheduleProgressSave();
  }

  function setToc(open) {
    document.body.classList.toggle('toc-open', Boolean(open));
    if (tocToggle) tocToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (tocOverlay) tocOverlay.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  function renderToc() {
    var fragment = document.createDocumentFragment();

    chapters.forEach(function (chapter, index) {
      var link = document.createElement('a');
      link.className = 'toc-link';
      link.href = Site.readerUrl(index);
      link.dataset.chapterIndex = String(index);
      link.setAttribute('aria-label', labelFor(chapter, index) + ' ' + chapter.name);

      var number = document.createElement('span');
      number.className = 'toc-number';
      number.textContent = String(index + 1).padStart(2, '0');

      var text = document.createElement('span');
      text.className = 'toc-text';

      var title = document.createElement('span');
      title.className = 'toc-title';
      title.textContent = chapter.name;

      var label = document.createElement('span');
      label.className = 'toc-label';
      label.textContent = labelFor(chapter, index);

      text.append(title, label);
      link.append(number, text);
      link.addEventListener('click', function (event) {
        event.preventDefault();
        if (index === currentIndex) {
          setToc(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        showChapter(index, { push: true, scrollTop: true });
      });
      fragment.append(link);
    });

    tocList.replaceChildren(fragment);
  }

  function highlightToc(index) {
    var links = tocList.querySelectorAll('.toc-link');
    links.forEach(function (link) {
      link.classList.toggle('is-active', Number(link.dataset.chapterIndex) === index);
    });

    var active = tocList.querySelector('.toc-link.is-active');
    if (active && tocPanel) {
      var panelRect = tocPanel.getBoundingClientRect();
      var activeRect = active.getBoundingClientRect();
      if (activeRect.top < panelRect.top + 24) {
        tocPanel.scrollTop -= panelRect.top + 24 - activeRect.top;
      } else if (activeRect.bottom > panelRect.bottom - 24) {
        tocPanel.scrollTop += activeRect.bottom - (panelRect.bottom - 24);
      }
    }

    if (tocMeta) {
      tocMeta.textContent = '第 ' + (index + 1) + ' / ' + chapters.length + ' 章';
    }
  }

  function pagerCard(targetIndex, direction) {
    var chapter = chapters[targetIndex];

    if (!chapter) {
      var disabled = document.createElement('span');
      disabled.className = 'pager-card is-disabled' + (direction === 'next' ? ' pager-next' : ' pager-prev');

      var disabledLabel = document.createElement('span');
      disabledLabel.className = 'pager-label';
      disabledLabel.textContent = direction === 'next' ? '下一章' : '上一章';

      var disabledTitle = document.createElement('span');
      disabledTitle.className = 'pager-title';
      disabledTitle.textContent = direction === 'next' ? '已是最后一章' : '已是第一章';

      disabled.append(disabledLabel, disabledTitle);
      return disabled;
    }

    var link = document.createElement('a');
    link.className = 'pager-card ' + (direction === 'next' ? 'pager-next' : 'pager-prev');
    link.href = Site.readerUrl(targetIndex);
    link.addEventListener('click', function (event) {
      event.preventDefault();
      showChapter(targetIndex, { push: true, scrollTop: true });
    });

    var label = document.createElement('span');
    label.className = 'pager-label';
    label.textContent = direction === 'next' ? '下一章 →' : '← 上一章';

    var title = document.createElement('span');
    title.className = 'pager-title';
    title.textContent = chapter.name;

    link.append(label, title);
    return link;
  }

  function renderPager(index) {
    if (!chapterPager) return;
    chapterPager.replaceChildren(
      pagerCard(index - 1, 'prev'),
      pagerCard(index + 1, 'next')
    );
  }

  function updateUrl(index, mode) {
    var url = new URL(window.location.href);
    url.searchParams.set('chapter', String(index + 1));
    url.searchParams.delete('resume');
    window.history[mode]({ chapter: index + 1 }, '', url);
  }

  function showChapter(index, options) {
    if (index < 0 || index >= chapters.length) return;
    var settings = options || {};
    var chapter = chapters[index];
    var changed = index !== currentIndex;

    currentIndex = index;

    chapterTitle.textContent = chapter.name;
    chapterKicker.textContent = '第一卷 · 六国旧事随流水 · ' + labelFor(chapter, index);
    chapterMeta.textContent =
      Core.formatCount(chapter.charCount) + ' · ' +
      Core.formatReadingTime(chapter.charCount);
    chapterContent.innerHTML = Core.renderMarkdown(chapter.body);
    chapterSheet.setAttribute('aria-label', chapter.name);

    if (readerChapter) {
      readerChapter.textContent = labelFor(chapter, index) + ' · ' + chapter.name;
    }

    document.title = chapter.name + ' · 道门';
    var description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute('content', chapter.name + '，道门 · 六国旧事随流水在线阅读。');
    }

    highlightToc(index);
    renderPager(index);

    if (settings.push) updateUrl(index, 'pushState');
    else if (settings.replaceUrl) updateUrl(index, 'replaceState');

    if (changed) setToc(false);

    if (settings.restoreScroll) {
      var progress = Site.getProgress();
      var ratio = progress && progress.chapterIndex === index ? progress.scrollRatio : 0;
      window.setTimeout(function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, Math.max(0, max * ratio));
        updateScrollUI();
        persistProgress();
      }, 80);
    } else if (settings.scrollTop) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      window.setTimeout(function () {
        updateScrollUI();
        persistProgress();
      }, 30);
    } else {
      updateScrollUI();
      persistProgress();
    }
  }

  function showFatal(error) {
    var box = document.createElement('div');
    box.className = 'load-error';
    var title = document.createElement('strong');
    title.textContent = '没能读到正文';
    var detail = document.createElement('p');
    detail.textContent = error && error.message
      ? error.message
      : '请确认手稿文件存在，并通过 HTTP 方式访问本站。';
    box.append(title, detail);

    chapterTitle.textContent = '载入失败';
    chapterKicker.textContent = '道门 · 六国旧事随流水';
    chapterMeta.textContent = '';
    chapterContent.replaceChildren(box);
    if (tocMeta) tocMeta.textContent = '目录不可用';
    if (chapterPager) chapterPager.replaceChildren();
  }

  function initialIndex() {
    var params = new URLSearchParams(window.location.search);
    var requested = Number(params.get('chapter'));
    var progress = Site.getProgress();

    if (Number.isInteger(requested) && requested > 0) {
      return {
        index: Math.min(requested - 1, chapters.length - 1),
        resume: params.get('resume') === '1' && progress && progress.chapterIndex === requested - 1
      };
    }

    if (progress && progress.chapterIndex < chapters.length) {
      return { index: progress.chapterIndex, resume: true };
    }

    return { index: 0, resume: false };
  }

  function updateFontButtons(scale) {
    if (fontDecrease) fontDecrease.disabled = scale <= 17;
    if (fontIncrease) fontIncrease.disabled = scale >= 24;
  }

  var fontScale = Site.setFontScale(Site.getFontScale());
  updateFontButtons(fontScale);

  if (fontDecrease) {
    fontDecrease.addEventListener('click', function () {
      fontScale = Site.setFontScale(fontScale - 1);
      updateFontButtons(fontScale);
      scheduleProgressSave();
    });
  }

  if (fontIncrease) {
    fontIncrease.addEventListener('click', function () {
      fontScale = Site.setFontScale(fontScale + 1);
      updateFontButtons(fontScale);
      scheduleProgressSave();
    });
  }

  if (tocToggle) {
    tocToggle.addEventListener('click', function () {
      setToc(!document.body.classList.contains('toc-open'));
    });
  }

  if (tocOverlay) {
    tocOverlay.addEventListener('click', function () { setToc(false); });
  }

  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', updateScrollUI);
  window.addEventListener('beforeunload', persistProgress);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') persistProgress();
  });

  document.addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      setToc(false);
      return;
    }

    var target = event.target;
    if (target && (
      target.isContentEditable ||
      /^(?:INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)
    )) {
      return;
    }

    if (event.key === 'ArrowLeft' && currentIndex > 0) {
      event.preventDefault();
      showChapter(currentIndex - 1, { push: true, scrollTop: true });
    }
    if (event.key === 'ArrowRight' && currentIndex < chapters.length - 1) {
      event.preventDefault();
      showChapter(currentIndex + 1, { push: true, scrollTop: true });
    }
  });

  window.addEventListener('popstate', function () {
    var params = new URLSearchParams(window.location.search);
    var requested = Number(params.get('chapter'));
    if (Number.isInteger(requested) && requested > 0 && requested <= chapters.length) {
      showChapter(requested - 1, { scrollTop: true });
    }
  });

  Site.loadVolume().then(function (data) {
    chapters = data;
    if (!chapters.length) {
      throw new Error('手稿中没有找到以“# 章节名”开头的章节标题。');
    }

    renderToc();
    var start = initialIndex();
    showChapter(start.index, {
      replaceUrl: true,
      restoreScroll: start.resume
    });
  }).catch(showFatal);
})();

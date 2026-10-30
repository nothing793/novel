(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NovelCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var NAMED_ENTITIES = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: '\u00a0',
    quot: '"'
  };

  function codePointToString(code) {
    try {
      return String.fromCodePoint(code);
    } catch (error) {
      return '';
    }
  }

  function decodeEntities(text) {
    return String(text)
      .replace(/&#x([0-9a-f]+);/gi, function (_, hex) {
        return codePointToString(parseInt(hex, 16));
      })
      .replace(/&#(\d+);/g, function (_, number) {
        return codePointToString(parseInt(number, 10));
      })
      .replace(/&([a-z]+);/gi, function (match, name) {
        var key = name.toLowerCase();
        return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)
          ? NAMED_ENTITIES[key]
          : match;
      });
  }

  function normalize(text) {
    return decodeEntities(String(text || ''))
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(url) {
    var value = decodeEntities(String(url || '')).trim();
    if (!value) return null;
    if (/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(value)) return value;
    return null;
  }

  function placeholderFactory() {
    var items = [];
    return {
      put: function (html) {
        var token = '\u0000' + items.length + '\u0000';
        items.push(html);
        return token;
      },
      restore: function (text) {
        return text.replace(/\u0000(\d+)\u0000/g, function (_, index) {
          return items[Number(index)] || '';
        });
      }
    };
  }

  function renderInline(raw) {
    var stash = placeholderFactory();
    var text = String(raw || '');

    text = text.replace(/`([^`]+)`/g, function (_, code) {
      return stash.put('<code>' + escapeHtml(code) + '</code>');
    });

    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (match, alt, src) {
      var url = safeUrl(src);
      if (!url) return match;
      return stash.put(
        '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '" loading="lazy">'
      );
    });

    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, href) {
      var url = safeUrl(href);
      if (!url) return match;
      var external = /^https?:/i.test(url);
      return stash.put(
        '<a href="' + escapeHtml(url) + '"' +
        (external ? ' target="_blank" rel="noopener noreferrer"' : '') +
        '>' + escapeHtml(label) + '</a>'
      );
    });

    text = escapeHtml(text);
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
    return stash.restore(text);
  }

  function splitBlocks(markdown) {
    var lines = normalize(markdown).split('\n');
    var blocks = [];
    var current = [];

    lines.forEach(function (line) {
      if (/^\s*$/.test(line)) {
        if (current.length) {
          blocks.push(current);
          current = [];
        }
        return;
      }
      current.push(line);
    });

    if (current.length) blocks.push(current);
    return blocks;
  }

  function renderMarkdown(markdown) {
    var blocks = splitBlocks(markdown);
    var output = [];

    blocks.forEach(function (block) {
      var first = block[0];

      if (/^\s*```/.test(first)) {
        var codeLines = block.slice();
        codeLines.shift();
        if (/^\s*```/.test(codeLines[codeLines.length - 1] || '')) codeLines.pop();
        output.push(
          '<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>'
        );
        return;
      }

      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(first)) {
        output.push('<hr>');
        return;
      }

      if (block.every(function (line) { return /^\s*>/.test(line); })) {
        var quote = block.map(function (line) {
          return line.replace(/^\s*>\s?/, '');
        }).join('\n');
        output.push(
          '<blockquote><p>' + renderInline(quote).replace(/\n/g, '<br>') + '</p></blockquote>'
        );
        return;
      }

      var heading = first.match(/^(#{2,6})\s+(.+?)\s*$/);
      if (heading) {
        var level = heading[1].length;
        output.push(
          '<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>'
        );
        if (block.length > 1) {
          var headingBody = block.slice(1).map(function (line) { return line.trim(); }).join('\n');
          output.push('<p>' + renderInline(headingBody).replace(/\n/g, '<br>') + '</p>');
        }
        return;
      }

      if (block.every(function (line) { return /^\s*(?:[-+*]|\d+\.)\s+/.test(line); })) {
        var ordered = /^\s*\d+\.\s+/.test(first);
        var tag = ordered ? 'ol' : 'ul';
        var listItems = block.map(function (line) {
          return '<li>' + renderInline(line.replace(/^\s*(?:[-+*]|\d+\.)\s+/, '')) + '</li>';
        }).join('');
        output.push('<' + tag + '>' + listItems + '</' + tag + '>');
        return;
      }

      var paragraph = block.map(function (line) { return line.trim(); }).join('\n');
      output.push('<p>' + renderInline(paragraph).replace(/\n/g, '<br>') + '</p>');
    });

    return output.join('\n');
  }

  function cleanBody(body) {
    return normalize(body)
      .split('\n')
      .filter(function (line) {
        return !/^\s*\[(?:返回)?目录\]\([^)]*\)\s*$/.test(line);
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function stripMarkdown(markdown) {
    return normalize(markdown)
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, '')
      .replace(/[*_`~]/g, '')
      .replace(/^\s*[-*_](?:\s*[-*_]){2,}\s*$/gm, '');
  }

  function countChars(markdown) {
    var plain = stripMarkdown(markdown).replace(/\s+/g, '');
    return Array.from(plain).length;
  }

  function parseChapterTitle(title) {
    var match = String(title || '').match(
      /^第\s*([一二三四五六七八九十百千零〇两\d]+)\s*章[\s·、：:，,.]*(.*)$/
    );
    if (!match) {
      return { label: '', name: String(title || '').trim() };
    }
    return {
      label: '第' + match[1] + '章',
      name: match[2].trim() || String(title || '').trim()
    };
  }

  function splitChapters(markdown) {
    var lines = normalize(markdown).split('\n');
    var chapters = [];
    var current = null;

    function flush() {
      if (!current) return;
      var body = cleanBody(current.bodyLines.join('\n'));
      if (body) {
        chapters.push({
          label: current.label,
          name: current.name,
          title: current.title,
          body: body,
          charCount: countChars(body)
        });
      }
      current = null;
    }

    lines.forEach(function (line) {
      var match = line.match(/^#\s+(.+?)\s*$/);
      if (match) {
        flush();
        var title = match[1].trim();
        if (title === '目录') return;
        var parsed = parseChapterTitle(title);
        current = {
          label: parsed.label,
          name: parsed.name,
          title: title,
          bodyLines: []
        };
        return;
      }
      if (current) current.bodyLines.push(line);
    });

    flush();

    return chapters.map(function (chapter, index) {
      chapter.index = index;
      return chapter;
    });
  }

  function parseOutline(markdown) {
    var lines = normalize(markdown).split('\n');
    var volumes = [];
    var current = null;

    function flush() {
      if (!current) return;
      var body = cleanBody(current.bodyLines.join('\n'));
      var match = current.title.match(
        /^第\s*([一二三四五六七八九十百千零〇两\d]+)\s*卷[\s·、：:，,.]*(.*)$/
      );
      volumes.push({
        label: match ? '第' + match[1] + '卷' : '',
        name: match ? (match[2].trim() || current.title) : current.title,
        title: current.title,
        body: body,
        description: stripMarkdown(body).replace(/\s+/g, ' ').trim()
      });
      current = null;
    }

    lines.forEach(function (line) {
      var match = line.match(/^#\s+(.+?)\s*$/);
      if (match) {
        flush();
        current = { title: match[1].trim(), bodyLines: [] };
        return;
      }
      if (current) current.bodyLines.push(line);
    });

    flush();

    return volumes.map(function (volume, index) {
      volume.index = index;
      return volume;
    });
  }

  function formatCount(count) {
    if (count >= 10000) {
      var value = count / 10000;
      var text = value >= 100 ? String(Math.round(value)) : value.toFixed(1);
      return text.replace(/\.0$/, '') + ' 万字';
    }
    return count + ' 字';
  }

  function formatReadingTime(count) {
    return Math.max(1, Math.round(count / 400)) + ' 分钟';
  }

  return {
    countChars: countChars,
    decodeEntities: decodeEntities,
    escapeHtml: escapeHtml,
    formatCount: formatCount,
    formatReadingTime: formatReadingTime,
    normalize: normalize,
    parseChapterTitle: parseChapterTitle,
    parseOutline: parseOutline,
    renderMarkdown: renderMarkdown,
    splitChapters: splitChapters,
    stripMarkdown: stripMarkdown
  };
});

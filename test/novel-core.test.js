'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../assets/novel-core.js');

const projectRoot = path.resolve(__dirname, '..');

test('splitChapters 跳过目录，并按一级标题拆章', () => {
  const markdown = [
    '# 目录',
    '| 目录 | 索引 |',
    '| --- | --- |',
    '',
    '# 第一章 伊始',
    '',
    '&#x09;第一段正文。',
    '',
    '[返回目录](#目录)',
    '',
    '# 第二章 入咸阳',
    '',
    '> 一首诗',
    '',
    '第二段正文。'
  ].join('\n');

  const chapters = Core.splitChapters(markdown);

  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].label, '第一章');
  assert.equal(chapters[0].name, '伊始');
  assert.match(chapters[0].body, /第一段正文/);
  assert.doesNotMatch(chapters[0].body, /返回目录/);
  assert.equal(chapters[1].label, '第二章');
  assert.equal(chapters[1].name, '入咸阳');
});

test('真实手稿只拆出 16 个已编号章节', () => {
  const source = fs.readFileSync(path.join(projectRoot, '道门/第一卷.md'), 'utf8');
  const chapters = Core.splitChapters(source);

  assert.equal(chapters.length, 16);
  assert.equal(chapters[0].label, '第一章');
  assert.equal(chapters[0].name, '伊始');
  assert.equal(chapters[15].label, '第十六章');
  assert.equal(chapters[15].name, '宫阙万间都做了土');
  assert.ok(chapters.every((chapter) => chapter.label));
  assert.ok(chapters.reduce((sum, chapter) => sum + chapter.charCount, 0) > 40000);
});

test('splitChapters 不发布未编号的草稿章节', () => {
  const markdown = [
    '# 第一章 定稿',
    '',
    '已经完成的正文。',
    '',
    '# 尚未编号的草稿',
    '',
    '这段内容还没有写完。',
    '',
    '# 第二章 另一章',
    '',
    '第二章正文。'
  ].join('\n');

  const chapters = Core.splitChapters(markdown);

  assert.equal(chapters.length, 2);
  assert.equal(chapters[0].name, '定稿');
  assert.equal(chapters[1].name, '另一章');
  assert.doesNotMatch(chapters[0].body, /没有写完/);
  assert.doesNotMatch(chapters[1].body, /没有写完/);
});

test('大纲可以解析出七卷', () => {
  const source = fs.readFileSync(path.join(projectRoot, '道门/大纲.md'), 'utf8');
  const volumes = Core.parseOutline(source);

  assert.equal(volumes.length, 7);
  assert.equal(volumes[0].label, '第一卷');
  assert.equal(volumes[0].name, '六国旧事随流水');
  assert.equal(volumes[1].label, '第二卷');
  assert.equal(volumes[1].name, '大漠孤城');
});

test('Markdown 渲染会转义 HTML，并支持引文与链接', () => {
  const html = Core.renderMarkdown([
    '<script>alert(1)</script>',
    '',
    '> 青华长乐界',
    '',
    '[外部链接](https://example.com)'
  ].join('\n'));

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<blockquote><p>青华长乐界<\/p><\/blockquote>/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(Core.renderMarkdown('[x](javascript:alert(1))'), /href="javascript/);
});

test('数字与阅读时间格式化', () => {
  assert.equal(Core.formatCount(9800), '9800 字');
  assert.equal(Core.formatCount(135711), '13.6 万字');
  assert.equal(Core.formatReadingTime(400), '1 分钟');
  assert.equal(Core.formatReadingTime(1200), '3 分钟');
});

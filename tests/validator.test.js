import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImportJson, stripCodeFences } from '../js/validator.js';
import { SAMPLE_IMPORT_JSON } from '../js/presets.js';

test('サンプルJSONがエラーなしで正常にインポート検証を通過する', () => {
  const res = validateImportJson(SAMPLE_IMPORT_JSON);
  assert.equal(res.ok, true);
  assert.equal(res.errors.length, 0);
  assert.equal(res.cards.length, 2);
  assert.equal(res.cards[0].title, '余弦定理');
  assert.equal(res.cards[0].status, 'unlearned');
});

test('Markdownコードフェンス（```json ... ```）付き入力を自動除去して取り込める', () => {
  const fenced = '```json\n[{"title":"オームの法則","formula":"{{V}} = {{I}}{{R}}"}]\n```';
  assert.equal(stripCodeFences(fenced).startsWith('['), true);

  const res = validateImportJson(fenced);
  assert.equal(res.ok, true);
  assert.equal(res.cards.length, 1);
  assert.equal(res.cards[0].subject, '未分類');
  assert.equal(res.cards[0].question, 'オームの法則の公式を答えよ。');
});

test('単一オブジェクトJSONも配列として自動正規化される', () => {
  const single = '{"title":"円の面積","formula":"{{S}} = {{\\\\pi r^2}}"}';
  const res = validateImportJson(single);
  assert.equal(res.ok, true);
  assert.equal(res.cards.length, 1);
  assert.equal(res.cards[0].formula, '{{S}} = {{\\pi r^2}}');
});

test('未エスケープ \\frac がフォームフィード(\\f)に化けた場合を的確にエラー検出する', () => {
  const corrupted = '[{"title":"解の公式","formula":"\\frac{1}{2}"}]';
  const res = validateImportJson(corrupted);
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /エスケープ漏れ/);
});

test('未エスケープ \\sqrt によるJSON構文エラーでバックスラッシュ二重化の案内を返す', () => {
  const bad = '[{"title":"平方根","formula":"\\sqrt{x}"}]';
  const res = validateImportJson(bad);
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /バックスラッシュ/);
});

test('必須項目 title / formula 欠落時にエラーを返す', () => {
  const missing = '[{"subject":"数学"}]';
  const res = validateImportJson(missing);
  assert.equal(res.ok, false);
  assert.equal(res.errors.length, 2);
});

test('閉じられていない {{ がある公式をエラー検出する', () => {
  const unclosed = '[{"title":"未閉鎖テスト","formula":"{{x} = 1"}]';
  const res = validateImportJson(unclosed);
  assert.equal(res.ok, false);
  assert.match(res.errors[0], /閉じられていない/);
});

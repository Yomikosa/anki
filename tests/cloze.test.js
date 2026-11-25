import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenizeCloze,
  stripClozeMarkers,
  buildKatexWithCloze,
  parseRichTextWithCloze,
  countCardClozeSlots,
} from '../js/cloze.js';
import { PRESET_FORMULAS } from '../js/presets.js';

test('二次方程式の解の公式（入れ子ブレース含む \\frac{{...}}{{...}}）を正確にパースする', () => {
  const formula = '{{x}} = \\frac{{-b \\pm \\sqrt{b^2 - 4ac}}}{{2a}}';
  const res = tokenizeCloze(formula, 0);

  assert.equal(res.unclosedCount, 0);
  assert.equal(res.nextSlotIndex, 3);

  const clozes = res.tokens.filter((t) => t.type === 'cloze');
  assert.deepEqual(
    clozes.map((c) => ({ index: c.index, content: c.content })),
    [
      { index: 0, content: 'x' },
      { index: 1, content: '-b \\pm \\sqrt{b^2 - 4ac}' },
      { index: 2, content: '2a' },
    ]
  );

  // stripClozeMarkers が有効な LaTeX を出力する
  assert.equal(
    stripClozeMarkers(formula),
    '{x} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'
  );
});

test('3重括弧 \\frac{{{A}}}{{{B}}} でも外側のLaTeXブレースを保持して正しくパースする', () => {
  const formula = '\\frac{{{-b \\pm \\sqrt{b^2 - 4ac}}}}{{{2a}}}';
  const res = tokenizeCloze(formula, 0);

  assert.equal(res.unclosedCount, 0);
  assert.equal(res.nextSlotIndex, 2);
  const clozes = res.tokens.filter((t) => t.type === 'cloze');
  assert.equal(clozes[0].content, '-b \\pm \\sqrt{b^2 - 4ac}');
  assert.equal(clozes[1].content, '2a');
  assert.equal(
    stripClozeMarkers(formula),
    '\\frac{{-b \\pm \\sqrt{b^2 - 4ac}}}{{2a}}'
  );
});

test('分数全体を含む穴埋め（等加速度直線運動の変位）を正確にパースする', () => {
  const formula = '{{x}} = {{v_0 t}} + {{\\frac{1}{2} a t^2}}';
  const res = tokenizeCloze(formula, 0);

  assert.equal(res.unclosedCount, 0);
  assert.equal(res.nextSlotIndex, 3);
  const clozes = res.tokens.filter((t) => t.type === 'cloze');
  assert.equal(clozes[2].content, '\\frac{1}{2} a t^2');
});

test('buildKatexWithCloze が個別開示状態に応じて hidden / revealed を切り替える', () => {
  const formula = '{{m}}{{a}} = {{F}}';
  const built = buildKatexWithCloze(formula, {
    mode: 'cloze',
    revealedSet: new Set([1]),
  });

  assert.equal(built.slotCount, 3);
  assert.match(built.latex, /cloze-id=0,cloze-state=hidden/);
  assert.match(built.latex, /cloze-id=1,cloze-state=revealed.*\{a\}/);
  assert.match(built.latex, /cloze-id=2,cloze-state=hidden/);
});

test('解説文中のインライン数式 $...$ と日本語テキストの穴埋めを通し番号で統合パースする', () => {
  const explanation =
    '判別式 $D = {{b^2 - 4ac}}$ のとき{{重解}}となり、$x = {{-b / 2a}}$ である。';
  const parsed = parseRichTextWithCloze(explanation, 3);

  assert.equal(parsed.totalSlots, 3);
  assert.equal(parsed.nextSlotIndex, 6);

  const mathSegments = parsed.segments.filter((s) => s.type === 'math');
  assert.equal(mathSegments.length, 2);
  assert.equal(mathSegments[0].startSlotIndex, 3);
  assert.equal(mathSegments[0].slotCount, 1);
  assert.equal(mathSegments[1].startSlotIndex, 5);
  assert.equal(mathSegments[1].slotCount, 1);
});

test('閉じ忘れの {{ を unclosedCount として検出する', () => {
  const res = tokenizeCloze('{{x = \\frac{1}{2}');
  assert.equal(res.unclosedCount, 1);
});

test('初期プリセット3件すべてに穴埋めスロットが含まれ構文エラーがない', () => {
  assert.equal(PRESET_FORMULAS.length, 3);
  for (const card of PRESET_FORMULAS) {
    assert.ok(countCardClozeSlots(card) >= 3, `${card.title} has enough cloze slots`);
    assert.equal(tokenizeCloze(card.formula).unclosedCount, 0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQuizChoices, hasBalancedBraces } from '../js/quiz-generator.js';
import { tokenizeCloze } from '../js/cloze.js';
import { PRESET_FORMULAS, SAMPLE_IMPORT_JSON } from '../js/presets.js';

test('二次方程式の解の公式の各穴埋めに対して4つの重複なし選択肢（正解1＋誤答3）を生成する', () => {
  const card = PRESET_FORMULAS[0];
  const { tokens } = tokenizeCloze(card.formula, 0);
  const clozes = tokens.filter((t) => t.type === 'cloze');

  assert.equal(clozes.length, 3);
  for (const cloze of clozes) {
    const choices = generateQuizChoices({
      answer: cloze.content,
      kind: 'math',
      formula: card.formula,
      allCards: PRESET_FORMULAS,
    });

    assert.equal(choices.length, 4);
    assert.equal(choices.filter((c) => c.isCorrect).length, 1);
    assert.equal(choices.find((c) => c.isCorrect).value, cloze.content);

    const uniqueValues = new Set(choices.map((c) => c.value.replace(/\s+/g, '')));
    assert.equal(uniqueValues.size, 4, `重複のない4選択肢であること: ${cloze.content}`);
    for (const c of choices) {
      assert.equal(hasBalancedBraces(c.value), true, `括弧の対応が取れていること: ${c.value}`);
    }
  }
});

test('解の公式の分子 -b \\pm \\sqrt{b^2 - 4ac} に対して符号違い等の実用的な誤答が生成される', () => {
  const answer = '-b \\pm \\sqrt{b^2 - 4ac}';
  const choices = generateQuizChoices({
    answer,
    kind: 'math',
    formula: PRESET_FORMULAS[0].formula,
    allCards: PRESET_FORMULAS,
  });

  const wrongs = choices.filter((c) => !c.isCorrect).map((c) => c.value);
  assert.equal(wrongs.length, 3);
  assert.ok(
    wrongs.some((w) => w.includes('b^2 + 4ac') || w.includes('2ac') || !w.startsWith('-')),
    `実用的な符号・係数違い誤答が含まれること: ${JSON.stringify(wrongs)}`
  );
});

test('プリセット3件＋サンプル2件のすべての数式穴埋めに対して4選択肢を破綻なく生成する', () => {
  const sampleCards = JSON.parse(SAMPLE_IMPORT_JSON);
  const all = [...PRESET_FORMULAS, ...sampleCards];

  for (const card of all) {
    const { tokens } = tokenizeCloze(card.formula, 0);
    for (const t of tokens) {
      if (t.type !== 'cloze') continue;
      const choices = generateQuizChoices({
        answer: t.content,
        kind: 'math',
        formula: card.formula,
        allCards: all,
      });
      assert.equal(choices.length, 4, `${card.title}: ${t.content}`);
      assert.equal(choices.filter((c) => c.isCorrect).length, 1);
      for (const c of choices) {
        assert.equal(hasBalancedBraces(c.value), true, `Balanced braces: ${c.value}`);
      }
    }
  }
});

test('日本語用語の穴埋め（重解・比例など）でも自然な4選択肢を生成する', () => {
  for (const term of ['重解', '比例', '反比例', '面積']) {
    const choices = generateQuizChoices({
      answer: term,
      kind: 'text',
      allCards: PRESET_FORMULAS,
    });
    assert.equal(choices.length, 4);
    assert.equal(choices.filter((c) => c.isCorrect).length, 1);
    assert.equal(choices.every((c) => c.kind === 'text'), true);
  }
});

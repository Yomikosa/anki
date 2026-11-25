/**
 * 選択式穴埋めクイズ用 誤答（ダミー選択肢）自動生成エンジン
 *
 * APIキー不要・完全クライアントサイドで、LaTeX数式や用語の「よくある間違い」
 * （符号反転、係数違い、指数違い、三角関数違い、類似変数など）を自動生成する。
 */

import { tokenizeCloze } from './cloze.js';

const MATH_VAR_GROUPS = [
  ['x', 'y', 'z', 'a', 'b', 'c', 'D', 't'],
  ['m', 'a', 'F', 'v', 'v_0', 't', 'g', 'x', 'h'],
  ['K', 'U', 'E', 'W', 'P', 'p', 'I', 'V', 'R', 'Q'],
  ['S', 'L', 'r', 'd', 'n', 'k', 'T', 'f', '\\lambda', '\\omega', '\\theta'],
];

const JP_TERM_DISTRACTORS = {
  重解: ['虚数解', '異なる2つの実数解', '実数解なし', '整数解'],
  比例: ['反比例', '2乗に比例', '無関係', '一定'],
  反比例: ['比例', '2乗に反比例', '2乗に比例', '一定'],
  面積: ['傾き', '切片', '曲率', '長さ'],
  三平方の定理: ['正弦定理', '中線定理', '加法定理', '方べきの定理'],
  '4倍': ['2倍', '8倍', '1/2倍', '1/4倍'],
  '2倍': ['4倍', '1/2倍', '変わらない', '√2倍'],
  合力の向き: ['速度の向き', '垂直方向', '逆向き', '接線方向'],
};

const FALLBACK_JP_TERMS = [
  '比例',
  '反比例',
  '一定',
  '重解',
  '虚数解',
  '面積',
  '傾き',
  '2倍',
  '4倍',
  '最大値',
  '最小値',
];

const FALLBACK_MATH_EXPRS = [
  '0',
  '1',
  '2',
  '-1',
  'a',
  'b',
  'x',
  'v',
  't',
  '2a',
  'a^2',
  '\\frac{1}{2}',
];

/**
 * 比較用の正規化（空白を除去して同一表記を判定）
 * @param {string} s
 * @returns {string}
 */
function normalize(s) {
  return String(s ?? '').replace(/\s+/g, '');
}

/**
 * 波括弧の開閉バランスが取れているか検証（壊れたLaTeXを除外するため）
 * @param {string} s
 * @returns {boolean}
 */
export function hasBalancedBraces(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\') {
      i++; // エスケープ文字をスキップ
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

/**
 * 文字列が主に日本語テキストか判定
 * @param {string} s
 * @returns {boolean}
 */
function isJapaneseText(s) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(s);
}

/**
 * 配列をフィッシャー・イェーツ法でシャッフル
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * LaTeX数式に対する「よくある間違い」候補を生成する
 * @param {string} expr
 * @param {string[]} formulaVars 同じ公式内の他の変数・シンボル
 * @returns {string[]}
 */
function generateMathMutations(expr, formulaVars = []) {
  const candidates = [];
  const add = (val) => {
    const trimmed = String(val ?? '').trim();
    if (!trimmed) return;
    if (normalize(trimmed) === normalize(expr)) return;
    if (!hasBalancedBraces(trimmed)) return;
    candidates.push(trimmed);
  };

  // 1. 単一数値（例: 0, 1, 2）
  if (/^-?\d+$/.test(expr)) {
    const n = Number(expr);
    add(String(n === 0 ? 1 : -n));
    add(String(n + 1));
    add(String(n === 0 ? -1 : n * 2));
    add(String(n === 0 ? 2 : n - 1));
    return candidates;
  }

  // 2. 単一変数・単純シンボル（例: x, m, a, F, K, \theta）
  if (/^(?:[a-zA-Z](?:_[0-9a-zA-Z])?|\\[a-zA-Z]+)$/.test(expr)) {
    // 同じ公式に登場する他の変数を優先的に誤答候補へ
    for (const v of formulaVars) {
      if (v !== expr) add(v);
    }
    for (const group of MATH_VAR_GROUPS) {
      if (group.includes(expr)) {
        for (const v of group) add(v);
      }
    }
    add(`${expr}^2`);
    add(`2${expr}`);
    return candidates;
  }

  // 3. 符号反転系（例: -b \pm \sqrt{b^2 - 4ac}, b^2 + c^2）
  if (expr.startsWith('-')) {
    add(expr.slice(1).trim());
  } else if (/^[a-zA-Z0-9\\]/.test(expr) && /[+\-\\]/.test(expr)) {
    add(`-${expr}`);
  }

  // 根号内や式中の - と + を反転
  if (expr.includes(' - ')) {
    add(expr.replace(' - ', ' + '));
  }
  if (expr.includes(' + ')) {
    add(expr.replace(' + ', ' - '));
  }
  if (expr.includes('\\pm')) {
    add(expr.replace('\\pm', '+'));
    add(expr.replace('\\pm', '-'));
  }

  // 4. 典型的な係数の取り違え（4ac <-> 2ac, 2a <-> a / 4a, \frac{1}{2} <-> 1 / \frac{1}{4}）
  if (expr.includes('4ac')) {
    add(expr.replace('4ac', '2ac'));
    add(expr.replace('4ac', '4a'));
  }
  if (/^\\frac\{1\}\{2\}/.test(expr)) {
    add(expr.replace(/^\\frac\{1\}\{2\}\s*/, ''));
    add(expr.replace(/^\\frac\{1\}\{2\}/, '\\frac{1}{4}'));
    add(expr.replace(/^\\frac\{1\}\{2\}/, '2'));
  }
  if (/^2([a-zA-Z])/.test(expr)) {
    add(expr.replace(/^2/, ''));
    add(expr.replace(/^2/, '4'));
    add(expr.replace(/^2([a-zA-Z])/, '$1^2'));
  }

  // 5. 指数（^2 <-> 1乗 / ^3、入れ替え）
  if (/\^2(?![0-9])/.test(expr)) {
    // 最後の ^2 を消す（例: \frac{1}{2} a t^2 -> \frac{1}{2} a t）
    const lastIdx = expr.lastIndexOf('^2');
    add(expr.slice(0, lastIdx) + expr.slice(lastIdx + 2));
    // 最後の ^2 を ^3 に変える
    add(expr.slice(0, lastIdx) + '^3' + expr.slice(lastIdx + 2));
    // 隣り合う文字に ^2 をずらす（例: a t^2 -> a^2 t, m v^2 -> m^2 v）
    if (/([a-zA-Z])\s+([a-zA-Z])\^2/.test(expr)) {
      add(expr.replace(/([a-zA-Z])\s+([a-zA-Z])\^2/, '$1^2 $2'));
    }
  } else if (/([a-zA-Z])$/.test(expr) && expr.length >= 2) {
    // 2乗を付ける（例: v_0 t -> v_0 t^2）
    add(`${expr}^2`);
  }

  // 6. 添字の欠落（例: v_0 t -> v t）
  if (/_0\b/.test(expr)) {
    add(expr.replace(/_0\b/g, ''));
    add(`\\frac{1}{2} ${expr}`);
  }

  // 7. 三角関数・対数の取り違え
  if (expr.includes('\\cos')) {
    add(expr.replace(/\\cos/g, '\\sin'));
    add(expr.replace(/\\cos/g, '\\tan'));
  } else if (expr.includes('\\sin')) {
    add(expr.replace(/\\sin/g, '\\cos'));
    add(expr.replace(/\\sin/g, '\\tan'));
  } else if (expr.includes('\\tan')) {
    add(expr.replace(/\\tan/g, '\\sin'));
    add(expr.replace(/\\tan/g, '\\cos'));
  }

  if (expr.includes('\\pi')) {
    add(expr.replace(/\\pi/, '2\\pi'));
    add(expr.replace(/\\pi/, '\\frac{\\pi}{2}'));
  }

  // 8. 一般の数値置換（2 <-> 4, 3 <-> 2）
  if (/\b2\b/.test(expr)) {
    add(expr.replace(/\b2\b/, '4'));
    add(expr.replace(/\b2\b/, '1'));
  }

  // 9. 公式内の文字置換（例: 2a -> 2b）
  if (/^[0-9]*[a-zA-Z]$/.test(expr)) {
    const ch = expr.slice(-1);
    const prefix = expr.slice(0, -1);
    for (const v of formulaVars) {
      if (/^[a-zA-Z]$/.test(v) && v !== ch) {
        add(`${prefix}${v}`);
      }
    }
    if (ch === 'a') add(`${prefix}b`);
    if (ch === 'b') add(`${prefix}a`);
  }

  return candidates;
}

/**
 * 数式文字列から単一文字変数のリストを抽出する
 * @param {string} latex
 * @returns {string[]}
 */
function extractFormulaVariables(latex) {
  const withoutCommands = String(latex ?? '').replace(/\\[a-zA-Z]+/g, ' ');
  const matches = withoutCommands.match(/\b[a-zA-Z](?:_0)?\b/g) || [];
  return Array.from(new Set(matches));
}

/**
 * 指定された穴埋めターゲットに対して、正解1つ＋誤答3つ＝計4つの選択肢を生成する
 *
 * @param {Object} params
 * @param {string} params.answer 正解の文字列（LaTeX または 日本語テキスト）
 * @param {'math'|'text'} [params.kind='math'] 選択肢の種別
 * @param {string} [params.formula=''] 同じカードの公式全文（関連変数抽出用）
 * @param {Array<{ formula?: string, explanation?: string }>} [params.allCards=[]] 他カードからのプール補完用
 * @param {number} [params.choiceCount=4] 生成する選択肢数
 * @returns {Array<{ id: string, value: string, isCorrect: boolean, kind: 'math'|'text' }>}
 */
export function generateQuizChoices({
  answer,
  kind = 'math',
  formula = '',
  allCards = [],
  choiceCount = 4,
}) {
  const cleanAnswer = String(answer ?? '').trim();
  const isText = kind === 'text' || isJapaneseText(cleanAnswer);
  const resolvedKind = isText ? 'text' : 'math';
  const neededDistractors = Math.max(1, choiceCount - 1);

  const seen = new Set([normalize(cleanAnswer)]);
  const distractors = [];

  const tryPush = (candidate) => {
    if (distractors.length >= neededDistractors) return;
    const trimmed = String(candidate ?? '').trim();
    if (!trimmed) return;
    const norm = normalize(trimmed);
    if (!norm || seen.has(norm)) return;
    if (resolvedKind === 'math' && !hasBalancedBraces(trimmed)) return;
    seen.add(norm);
    distractors.push(trimmed);
  };

  if (resolvedKind === 'text') {
    // 1. 事前定義の対義語・類似用語
    if (JP_TERM_DISTRACTORS[cleanAnswer]) {
      for (const item of JP_TERM_DISTRACTORS[cleanAnswer]) {
        tryPush(item);
      }
    }
    // 2. 他カードのテキスト穴埋め候補
    for (const c of allCards) {
      const { tokens } = tokenizeCloze(c.explanation || '', 0);
      for (const t of tokens) {
        if (t.type === 'cloze' && isJapaneseText(t.content)) {
          tryPush(t.content);
        }
      }
    }
    // 3. 共通フォールバック用語
    for (const term of FALLBACK_JP_TERMS) {
      tryPush(term);
    }
  } else {
    // 1. 数学・物理の典型ミスパターン生成（最優先）
    const formulaVars = extractFormulaVariables(formula);
    const mutations = generateMathMutations(cleanAnswer, formulaVars);
    for (const m of mutations) {
      tryPush(m);
    }

    // 2. 他カードの同程度の長さの穴埋め数式から補完
    const otherSlots = [];
    for (const c of allCards) {
      const { tokens } = tokenizeCloze(c.formula || '', 0);
      for (const t of tokens) {
        if (t.type === 'cloze' && !isJapaneseText(t.content)) {
          otherSlots.push(t.content);
        }
      }
    }
    // 長さが近いものを優先して違和感のない選択肢にする
    otherSlots.sort(
      (a, b) => Math.abs(a.length - cleanAnswer.length) - Math.abs(b.length - cleanAnswer.length)
    );
    for (const slot of otherSlots) {
      tryPush(slot);
    }

    // 3. 共通数学フォールバック
    for (const fb of FALLBACK_MATH_EXPRS) {
      tryPush(fb);
    }
  }

  const options = [
    { value: cleanAnswer, isCorrect: true, kind: resolvedKind },
    ...distractors.slice(0, neededDistractors).map((val) => ({
      value: val,
      isCorrect: false,
      kind: resolvedKind,
    })),
  ];

  return shuffleArray(options).map((opt, idx) => ({
    ...opt,
    id: `opt-${idx}`,
  }));
}

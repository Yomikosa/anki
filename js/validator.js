/**
 * JSONインポート用バリデーター＆正規化モジュール
 *
 * - Markdownコードフェンス（```json ... ```）の自動除去
 * - Gemini出力で頻出する LaTeX バックスラッシュ未エスケープエラーの診断
 * - 必須項目・型・{{ }}対応・KaTeX構文のドライランチェック
 */

import { tokenizeCloze, stripClozeMarkers } from './cloze.js';

export const VALID_STATUSES = new Set(['unlearned', 'review', 'mastered']);

/**
 * 入力文字列から前後の Markdown コードフェンスを除去する
 * @param {string} raw
 * @returns {string}
 */
export function stripCodeFences(raw) {
  let trimmed = (raw || '').trim();
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\s*\r?\n?([\s\S]*?)\r?\n?```$/);
  if (fenceMatch) {
    trimmed = fenceMatch[1].trim();
  }
  return trimmed;
}

/**
 * JSON.parse が失敗した原因を分析し、日本語の分かりやすい診断メッセージを返す
 * @param {string} text
 * @param {Error} err
 * @returns {string[]}
 */
function diagnoseJsonSyntaxError(text, err) {
  const messages = [];
  const rawMessage = err?.message || '不明な構文エラー';

  // Bad escaped character (e.g. \frac -> \f is valid, \sqrt -> \s is INVALID!)
  if (/bad escaped character|invalid escape/i.test(rawMessage) || /\\[^"\\/bfnrtu]/.test(text)) {
    messages.push(
      'JSON文字列内で LaTeX のバックスラッシュ（\\）が正しく二重エスケープされていない箇所があります。例：\\sqrt → \\\\sqrt、\\pm → \\\\pm、\\cdot → \\\\cdot に修正するか、Geminiへ「LaTeXのバックスラッシュを \\\\ にエスケープして再出力して」と指示してください。'
    );
  } else if (/unexpected token|expected/i.test(rawMessage)) {
    messages.push(
      'JSONの構文が正しくありません（末尾の余分なカンマ、閉じ括弧の不足、前後の不要な文章の混入などをご確認ください）。'
    );
  } else {
    messages.push('JSON形式として読み取れませんでした。括弧や引用符の対応をご確認ください。');
  }

  messages.push(`詳細エラー: ${rawMessage}`);
  return messages;
}

/**
 * JSONパース自体は通ったものの、\frac の \f（フォームフィード）、\theta の \t（タブ）、
 * \beta の \b（バックスペース）、\rho の \r（キャリッジリターン）が制御文字として
 * 誤解釈されていないか検知する
 * @param {string} value
 * @returns {string[]} 検出された疑わしい制御文字の例
 */
export function detectControlCharCorruption(value) {
  if (typeof value !== 'string') return [];
  const findings = [];
  if (value.includes('\f')) findings.push('\\frac や \\forall 等が制御文字（\\f）に化けている可能性');
  if (value.includes('\b')) findings.push('\\beta や \\bar 等が制御文字（\\b）に化けている可能性');
  if (value.includes('\t')) findings.push('\\theta や \\times、\\tan 等がタブ文字（\\t）に化けている可能性');
  if (value.includes('\r')) findings.push('\\rho や \\right 等が改行コード（\\r）に化けている可能性');
  return findings;
}

/**
 * ユニークなカードIDを生成
 * @returns {string}
 */
export function generateCardId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `card-${crypto.randomUUID()}`;
  }
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * インポート入力テキストを検証・正規化する
 *
 * @param {string} rawText ユーザーが貼り付けたJSON文字列
 * @param {Object} [options]
 * @param {(latex: string) => void} [options.validateKatex] KaTeX構文検証コールバック（任意）
 * @returns {{
 *   ok: boolean,
 *   cards: Array<Object>,
 *   errors: string[],
 *   warnings: string[]
 * }}
 */
export function validateImportJson(rawText, options = {}) {
  const { validateKatex } = options;
  const cleaned = stripCodeFences(rawText);

  if (!cleaned) {
    return {
      ok: false,
      cards: [],
      errors: ['JSONが入力されていません。Geminiが出力したJSONを貼り付けてください。'],
      warnings: [],
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      ok: false,
      cards: [],
      errors: diagnoseJsonSyntaxError(cleaned, err),
      warnings: [],
    };
  }

  // 単一オブジェクトの場合は配列へ自動ラップして利便性を高める
  const items = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? [parsed]
      : null;

  if (!items) {
    return {
      ok: false,
      cards: [],
      errors: ['JSONのルート要素は配列（[ ... ]）またはオブジェクト（{ ... }）である必要があります。'],
      warnings: [],
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      cards: [],
      errors: ['配列が空です。1件以上の公式オブジェクトを含めてください。'],
      warnings: [],
    };
  }

  const errors = [];
  const warnings = [];
  const cards = [];
  const now = new Date().toISOString();

  items.forEach((item, idx) => {
    const label = `${idx + 1}件目`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${label}: 各要素は公式オブジェクト（{ ... }）である必要があります。`);
      return;
    }

    const rawFormula = typeof item.formula === 'string' ? item.formula : '';
    const rawExplanation = typeof item.explanation === 'string' ? item.explanation : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const formula = rawFormula.trim();
    const subject =
      typeof item.subject === 'string' && item.subject.trim() ? item.subject.trim() : '未分類';
    const category = typeof item.category === 'string' ? item.category.trim() : '';
    const question =
      typeof item.question === 'string' && item.question.trim()
        ? item.question.trim()
        : `${title}の公式を答えよ。`;
    const explanation = rawExplanation.trim();
    const status = VALID_STATUSES.has(item.status) ? item.status : 'unlearned';

    if (!title) {
      errors.push(`${label}: 必須項目 "title"（公式名）が空または文字列ではありません。`);
    }
    if (!formula) {
      errors.push(`${label}: 必須項目 "formula"（LaTeX数式）が空または文字列ではありません。`);
    }

    if (!title || !formula) {
      return;
    }

    // 制御文字化けチェック（未エスケープ \frac, \theta など — trim 前の生文字列で検査）
    const formulaCorruptions = detectControlCharCorruption(rawFormula);
    if (formulaCorruptions.length > 0) {
      errors.push(
        `${label}「${title}」: formula 内で LaTeX コマンドのエスケープ漏れが検出されました（${formulaCorruptions.join('／')}）。バックスラッシュを \\\\ のように二重にしてください。`
      );
      return;
    }

    const expCorruptions = detectControlCharCorruption(rawExplanation);
    if (expCorruptions.length > 0) {
      warnings.push(
        `${label}「${title}」: explanation 内にエスケープ漏れの疑いがあります（${expCorruptions.join('／')}）。取り込み後に表示を確認してください。`
      );
    }

    // 穴埋め {{ }} の閉じ忘れチェック
    const formulaTokenRes = tokenizeCloze(formula, 0);
    if (formulaTokenRes.unclosedCount > 0) {
      errors.push(
        `${label}「${title}」: formula 内に閉じられていない "{{" があります。"{{ ... }}" の対応を確認してください。`
      );
      return;
    }

    const expTokenRes = tokenizeCloze(explanation, 0);
    if (expTokenRes.unclosedCount > 0) {
      warnings.push(
        `${label}「${title}」: explanation 内に閉じられていない "{{" が含まれています。`
      );
    }

    // 穴埋めが1つもない場合は警告（取り込み自体は許可）
    const totalClozes = formulaTokenRes.nextSlotIndex + expTokenRes.nextSlotIndex;
    if (totalClozes === 0) {
      warnings.push(
        `${label}「${title}」: 穴埋め箇所（{{ }}）が含まれていません（管理画面の「編集」から後から追加できます）。`
      );
    }

    // KaTeX 構文のドライランチェック（渡されている場合）
    if (typeof validateKatex === 'function') {
      try {
        validateKatex(stripClozeMarkers(formula));
      } catch (katexErr) {
        errors.push(
          `${label}「${title}」: 数式のLaTeX構文エラーが検出されました（${katexErr?.message || 'KaTeXエラー'}）。`
        );
        return;
      }
    }

    cards.push({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : generateCardId(),
      subject,
      category,
      title,
      question,
      formula,
      explanation,
      status,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
      updatedAt: now,
    });
  });

  if (errors.length > 0) {
    return {
      ok: false,
      cards: [],
      errors,
      warnings,
    };
  }

  return {
    ok: true,
    cards,
    errors: [],
    warnings,
  };
}

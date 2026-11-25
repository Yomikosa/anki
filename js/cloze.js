/**
 * スタサプ風穴埋め（{{...}}）ブレース深度対応パーサー
 *
 * - LaTeXコマンド内の入れ子ブレース（例: \frac{{-b \pm \sqrt{b^2 - 4ac}}}{{2a}}）を正確に追跡
 * - 2重括弧 \frac{{A}}{{B}} と 3重括弧 \frac{{{A}}}{{{B}}} の双方を透過的にサポート
 * - 解説文中のインライン数式 ($...$ / $$...$$) と日本語テキスト中の {{...}} を統合パース
 */

/**
 * 指定位置が直前の奇数個のバックスラッシュによってエスケープされているか判定
 * @param {string} str
 * @param {number} index
 * @returns {boolean}
 */
function isEscaped(str, index) {
  let backslashCount = 0;
  let i = index - 1;
  while (i >= 0 && str[i] === '\\') {
    backslashCount++;
    i--;
  }
  return backslashCount % 2 === 1;
}

/**
 * 開始位置 startIndex（"{{" の直後）から対応する "}}" をブレース深度を考慮して探索
 * @param {string} str
 * @param {number} contentStart
 * @returns {{ endIndex: number, content: string } | null}
 */
function findClozeClose(str, contentStart) {
  let depth = 0;
  let i = contentStart;

  while (i < str.length) {
    const ch = str[i];

    if (ch === '{' && !isEscaped(str, i)) {
      depth++;
      i++;
      continue;
    }

    if (ch === '}' && !isEscaped(str, i)) {
      if (depth > 0) {
        depth--;
        i++;
        continue;
      }
      // depth === 0 で "}}" が来たら穴埋め終了
      if (i + 1 < str.length && str[i + 1] === '}' && !isEscaped(str, i + 1)) {
        return {
          endIndex: i, // 最初の "}" の位置（閉じ記号は i, i+1）
          content: str.slice(contentStart, i),
        };
      }
    }

    i++;
  }

  return null;
}

/**
 * "{{{" のように3連以上の開き波括弧に遭遇したとき、
 * 外側の "{" が LaTeX 引数用（例: \frac{{{A}}}{{{B}}}）かどうかを先読み判定する。
 * @param {string} str
 * @param {number} index 最初の "{" の位置
 * @returns {boolean} true なら最初の "{" をリテラル扱いして次から "{{" を開始する
 */
function shouldKeepOuterBrace(str, index) {
  if (str[index + 2] !== '{' || isEscaped(str, index + 2)) {
    return false;
  }
  // index+1 から "{{" を始めた場合に、対応する "}}" の直後に "}" が来るなら
  // 外側の { ... } が LaTeX グループとして完結している（例: \frac{{{x}}}{{{2}}}）
  const innerMatch = findClozeClose(str, index + 3);
  if (
    innerMatch &&
    innerMatch.endIndex + 2 < str.length &&
    str[innerMatch.endIndex + 2] === '}' &&
    !isEscaped(str, innerMatch.endIndex + 2)
  ) {
    return true;
  }
  return false;
}

/**
 * 文字列内の {{...}} をブレース深度対応でトークン配列へ分解する
 * @param {string} input
 * @param {number} [startSlotIndex=0] 通し番号の開始値
 * @returns {{
 *   tokens: Array<{ type: 'raw', value: string } | { type: 'cloze', index: number, content: string }>,
 *   nextSlotIndex: number,
 *   unclosedCount: number
 * }}
 */
export function tokenizeCloze(input, startSlotIndex = 0) {
  const str = typeof input === 'string' ? input : '';
  const tokens = [];
  let slotIndex = startSlotIndex;
  let unclosedCount = 0;
  let buffer = '';
  let i = 0;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      tokens.push({ type: 'raw', value: buffer });
      buffer = '';
    }
  };

  while (i < str.length) {
    if (
      str[i] === '{' &&
      i + 1 < str.length &&
      str[i + 1] === '{' &&
      !isEscaped(str, i) &&
      !isEscaped(str, i + 1)
    ) {
      // 3連波括弧 {{{...}}} の場合、外側がLaTeX引数ブレースなら1文字目をリテラル出力
      if (i + 2 < str.length && shouldKeepOuterBrace(str, i)) {
        buffer += '{';
        i += 1;
        continue;
      }

      const match = findClozeClose(str, i + 2);
      if (match) {
        flushBuffer();
        tokens.push({
          type: 'cloze',
          index: slotIndex,
          content: match.content.trim(),
        });
        slotIndex++;
        i = match.endIndex + 2;
        continue;
      } else {
        unclosedCount++;
        buffer += '{{';
        i += 2;
        continue;
      }
    }

    buffer += str[i];
    i++;
  }

  flushBuffer();

  return {
    tokens,
    nextSlotIndex: slotIndex,
    unclosedCount,
  };
}

/**
 * 数式文字列からすべての {{...}} マーカーを除去した「完全なLaTeX文字列」を返す
 * （通常一問一答モードやKaTeX構文検証用）
 *
 * 例: \frac{{-b \pm \sqrt{b^2 - 4ac}}}{{2a}} -> \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
 * ただしグループ境界を保持するため {content} で包む。
 * @param {string} latex
 * @returns {string}
 */
export function stripClozeMarkers(latex) {
  const { tokens } = tokenizeCloze(latex, 0);
  return tokens
    .map((token) => (token.type === 'cloze' ? `{${token.content}}` : token.value))
    .join('');
}

/**
 * KaTeX 描画用の LaTeX 文字列を生成する
 * - mode === 'cloze': 穴埋め箇所を \htmlData{cloze-id=N}{\htmlClass{...}{...}} に変換
 * - mode === 'full': 穴埋めをすべて素のLaTeXとして描画
 * - mode === 'preview': 管理一覧用（穴埋め箇所をハイライト枠付きで全表示）
 *
 * @param {string} latex
 * @param {Object} options
 * @param {Set<number>} [options.revealedSet]
 * @param {'cloze'|'full'|'preview'} [options.mode='cloze']
 * @param {number} [options.startSlotIndex=0]
 * @returns {{ latex: string, slotCount: number, nextSlotIndex: number, slots: Array<{ index: number, content: string }> }}
 */
export function buildKatexWithCloze(latex, options = {}) {
  const { revealedSet = new Set(), mode = 'cloze', startSlotIndex = 0 } = options;
  const { tokens, nextSlotIndex } = tokenizeCloze(latex, startSlotIndex);
  const slots = [];

  const rendered = tokens
    .map((token) => {
      if (token.type === 'raw') {
        return token.value;
      }
      slots.push({ index: token.index, content: token.content });

      if (mode === 'full') {
        return `{${token.content}}`;
      }

      if (mode === 'preview') {
        return `{\\htmlClass{cloze-preview-chip}{${token.content}}}`;
      }

      const isRevealed = revealedSet.has(token.index);
      if (isRevealed) {
        return `{\\htmlData{cloze-id=${token.index},cloze-state=revealed}{\\htmlClass{cloze-katex cloze-katex--revealed}{${token.content}}}}`;
      }
      return `{\\htmlData{cloze-id=${token.index},cloze-state=hidden}{\\htmlClass{cloze-katex cloze-katex--hidden}{\\text{ ? }}}}`;
    })
    .join('');

  return {
    latex: rendered,
    slotCount: slots.length,
    nextSlotIndex,
    slots,
  };
}

/**
 * 解説文などのリッチテキストを「通常テキスト」「インライン数式 ($...$)」「ブロック数式 ($$...$$)」に分割する。
 * さらに各セグメント内の {{...}} に通し番号を割り振る。
 *
 * 例: "判別式 $D = {{b^2 - 4ac}}$ のとき{{重解}}となる。"
 *
 * @param {string} text
 * @param {number} [startSlotIndex=0]
 * @returns {{
 *   segments: Array<
 *     | { type: 'text', tokens: Array<{ type: 'raw', value: string } | { type: 'cloze', index: number, content: string }> }
 *     | { type: 'math', display: boolean, rawLatex: string, startSlotIndex: number, slotCount: number }
 *   >,
 *   nextSlotIndex: number,
 *   totalSlots: number
 * }}
 */
export function parseRichTextWithCloze(text, startSlotIndex = 0) {
  const str = typeof text === 'string' ? text : '';
  const rawSegments = [];
  let i = 0;
  let textBuf = '';

  const flushText = () => {
    if (textBuf.length > 0) {
      rawSegments.push({ type: 'text', content: textBuf });
      textBuf = '';
    }
  };

  while (i < str.length) {
    if (str[i] === '$' && !isEscaped(str, i)) {
      const isDisplay = i + 1 < str.length && str[i + 1] === '$';
      const delim = isDisplay ? '$$' : '$';
      const searchStart = i + delim.length;

      // 閉じデリミタを探索
      let closeIdx = -1;
      let j = searchStart;
      while (j < str.length) {
        if (str[j] === '$' && !isEscaped(str, j)) {
          if (isDisplay) {
            if (j + 1 < str.length && str[j + 1] === '$') {
              closeIdx = j;
              break;
            }
          } else {
            // インライン数式は改行をまたがないのが通常だが、閉じ $ が見つかれば採用
            closeIdx = j;
            break;
          }
        }
        j++;
      }

      if (closeIdx !== -1 && closeIdx > searchStart) {
        flushText();
        rawSegments.push({
          type: 'math',
          display: isDisplay,
          content: str.slice(searchStart, closeIdx),
        });
        i = closeIdx + delim.length;
        continue;
      }
    }

    textBuf += str[i];
    i++;
  }

  flushText();

  // 各セグメントの {{...}} に通し番号を付与
  let currentSlot = startSlotIndex;
  const segments = rawSegments.map((seg) => {
    if (seg.type === 'text') {
      const { tokens, nextSlotIndex } = tokenizeCloze(seg.content, currentSlot);
      currentSlot = nextSlotIndex;
      return {
        type: 'text',
        tokens,
      };
    }

    const segStart = currentSlot;
    const { nextSlotIndex } = tokenizeCloze(seg.content, currentSlot);
    const slotCount = nextSlotIndex - segStart;
    currentSlot = nextSlotIndex;
    return {
      type: 'math',
      display: seg.display,
      rawLatex: seg.content,
      startSlotIndex: segStart,
      slotCount,
    };
  });

  return {
    segments,
    nextSlotIndex: currentSlot,
    totalSlots: currentSlot - startSlotIndex,
  };
}

/**
 * カード全体（formula + explanation）に含まれる穴埋めスロットの総数を計算
 * @param {{ formula?: string, explanation?: string }} card
 * @returns {number}
 */
export function countCardClozeSlots(card) {
  const formulaRes = tokenizeCloze(card?.formula || '', 0);
  const explanationRes = parseRichTextWithCloze(card?.explanation || '', formulaRes.nextSlotIndex);
  return explanationRes.nextSlotIndex;
}

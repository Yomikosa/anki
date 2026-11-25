/**
 * 「学習する（カード・穴埋め）」画面コントローラー
 * - PC UI: 1行のスリムなツールバー + 集中できる学習カード
 * - スマホ UI: 画面上部に余計なUIを置かずカードを即表示。条件・モード切替はボトムシートで操作
 */

import { countCardClozeSlots } from './cloze.js';
import { renderKatexFormula, renderRichTextExplanation } from './katex-renderer.js';
import {
  ICONS,
  STATUS_META,
  STATUS_ORDER,
  escapeHtml,
} from './ui-helpers.js';

export class StudyView {
  /**
   * @param {HTMLElement} root
   * @param {import('./store.js').FormulaStore} store
   * @param {{
   *   onNavigateToImport: () => void,
   *   onStudyMetaChange: (meta: { counterText: string, hasActiveFilter: boolean, mode: string }) => void,
   *   announce: (msg: string) => void
   * }} callbacks
   */
  constructor(root, store, callbacks) {
    this.root = root;
    this.store = store;
    this.callbacks = callbacks;

    this.statusFilter = 'all';
    this.subjectFilter = 'all';
    this.studyMode = store.getStudyMode(); // 'cloze' | 'qa'
    this.shuffledOrder = null;
    this.currentCardId = null;

    this.revealedSet = new Set();
    this.qaAnswerVisible = false;
    this.justToggledSlot = null;

    this.optionsSheet = document.getElementById('study-options-sheet');
    this.render();
  }

  /**
   * ホーム画面などのクイックデッキから条件付きで学習開始
   * @param {{ status?: string, subject?: string, shuffle?: boolean }} [opts]
   */
  startSession(opts = {}) {
    this.statusFilter = opts.status ?? 'all';
    this.subjectFilter = opts.subject ?? 'all';
    this.shuffledOrder = null;
    this.currentCardId = null;
    this.revealedSet = new Set();
    this.qaAnswerVisible = false;
    this.justToggledSlot = null;

    if (opts.shuffle) {
      this._generateShuffleOrder();
    }
    this.render();
  }

  /**
   * 一覧やインポート完了時から特定カードを開いて学習開始
   * @param {string} cardId
   */
  focusCard(cardId) {
    const target = this.store.getById(cardId);
    if (!target) {
      this.render();
      return;
    }

    if (this.statusFilter !== 'all' && target.status !== this.statusFilter) {
      this.statusFilter = 'all';
    }
    if (this.subjectFilter !== 'all' && target.subject !== this.subjectFilter) {
      this.subjectFilter = 'all';
    }
    this.shuffledOrder = null;
    this.currentCardId = cardId;
    this.revealedSet = new Set();
    this.qaAnswerVisible = false;
    this.justToggledSlot = null;
    this.render();
  }

  /**
   * スマホ用「学習設定・絞り込み」ボトムシートを開く
   */
  openOptionsSheet() {
    if (!this.optionsSheet) return;
    this._renderOptionsSheet();
    this.optionsSheet.showModal();
  }

  _generateShuffleOrder() {
    const allIds = this.store.getAll().map((c) => c.id);
    for (let i = allIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }
    this.shuffledOrder = allIds;
  }

  _getFilteredCards() {
    let cards = this.store.getAll();

    if (this.shuffledOrder) {
      const orderMap = new Map(this.shuffledOrder.map((id, idx) => [id, idx]));
      cards.sort((a, b) => {
        const ia = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
        const ib = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
        return ia - ib;
      });
    }

    if (this.statusFilter !== 'all') {
      cards = cards.filter((c) => c.status === this.statusFilter);
    }
    if (this.subjectFilter !== 'all') {
      cards = cards.filter((c) => c.subject === this.subjectFilter);
    }
    return cards;
  }

  _resolveCurrentIndex(filteredCards) {
    if (filteredCards.length === 0) {
      this.currentCardId = null;
      return -1;
    }
    const foundIdx = filteredCards.findIndex((c) => c.id === this.currentCardId);
    if (foundIdx !== -1) return foundIdx;

    this.currentCardId = filteredCards[0].id;
    this.revealedSet = new Set();
    this.qaAnswerVisible = false;
    this.justToggledSlot = null;
    return 0;
  }

  _switchCard(nextCard) {
    if (!nextCard) return;
    this.currentCardId = nextCard.id;
    this.revealedSet = new Set();
    this.qaAnswerVisible = false;
    this.justToggledSlot = null;
    this.render();
  }

  _toggleMode() {
    this.studyMode = this.studyMode === 'cloze' ? 'qa' : 'cloze';
    this.store.setStudyMode(this.studyMode);
    this.revealedSet = new Set();
    this.qaAnswerVisible = false;
    this.justToggledSlot = null;
    this.render();
    this.callbacks.announce(
      this.studyMode === 'cloze'
        ? '穴埋めモード（スタサプ風）に切り替えました。'
        : '通常一問一答モードに切り替えました。'
    );
  }

  _handleShuffle() {
    this._generateShuffleOrder();
    const filtered = this._getFilteredCards();
    if (filtered.length > 0) {
      this._switchCard(filtered[0]);
      this.callbacks.announce('カードの順番をシャッフルしました。');
    }
  }

  _handleToggleSlot(slotIndex, viaKeyboard) {
    if (this.revealedSet.has(slotIndex)) {
      this.revealedSet.delete(slotIndex);
    } else {
      this.revealedSet.add(slotIndex);
    }
    this.justToggledSlot = slotIndex;
    this._renderCardDynamicContent();

    if (viaKeyboard) {
      const nextFocusTarget = this.root.querySelector(`[data-cloze-id="${slotIndex}"]`);
      if (nextFocusTarget) nextFocusTarget.focus();
    }
  }

  _handleRevealAll(totalSlots) {
    this.revealedSet = new Set();
    for (let i = 0; i < totalSlots; i++) {
      this.revealedSet.add(i);
    }
    this.justToggledSlot = null;
    this._renderCardDynamicContent();
    this.callbacks.announce('すべての穴埋めを表示しました。');
  }

  _handleHideAll() {
    this.revealedSet = new Set();
    this.justToggledSlot = null;
    this._renderCardDynamicContent();
    this.callbacks.announce('すべての穴埋めを隠しました。');
  }

  _hasActiveFilter() {
    return this.statusFilter !== 'all' || this.subjectFilter !== 'all';
  }

  render() {
    const stats = this.store.getStats();
    const subjects = this.store.getSubjects();
    if (this.subjectFilter !== 'all' && !subjects.includes(this.subjectFilter)) {
      this.subjectFilter = 'all';
    }

    const filteredCards = this._getFilteredCards();
    const currentIndex = this._resolveCurrentIndex(filteredCards);
    const currentCard = currentIndex >= 0 ? filteredCards[currentIndex] : null;
    const isClozeMode = this.studyMode === 'cloze';
    const hasFilter = this._hasActiveFilter();

    // スマホトップバー用のカウンター・フィルタ状態を通知
    this.callbacks.onStudyMetaChange?.({
      counterText: currentCard ? `${currentIndex + 1} / ${filteredCards.length}` : '0件',
      hasActiveFilter: hasFilter,
      mode: this.studyMode,
    });

    this.root.innerHTML = `
      <div class="study-layout">
        <!-- PC専用：スリムな1行ツールバー（スマホでは非表示） -->
        <div class="study-toolbar-pc glass-panel" aria-label="学習条件とモード設定">
          <button
            type="button"
            id="study-mode-switch-pc"
            class="dads-switch dads-switch--compact"
            role="switch"
            aria-checked="${isClozeMode ? 'true' : 'false'}"
          >
            <span class="dads-switch__track" aria-hidden="true">
              <span class="dads-switch__thumb"></span>
            </span>
            <span class="dads-switch__label">
              ${isClozeMode ? '穴埋めモード' : '一問一答モード'}
            </span>
          </button>

          <div class="study-toolbar-pc__right">
            <label for="study-status-filter-pc" class="sr-only">ステータスで絞り込み</label>
            <select id="study-status-filter-pc" class="dads-select dads-select--compact">
              <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>すべて（${stats.total}）</option>
              <option value="unlearned" ${this.statusFilter === 'unlearned' ? 'selected' : ''}>未習得（${stats.unlearned}）</option>
              <option value="review" ${this.statusFilter === 'review' ? 'selected' : ''}>復習が必要（${stats.review}）</option>
              <option value="mastered" ${this.statusFilter === 'mastered' ? 'selected' : ''}>習得済み（${stats.mastered}）</option>
            </select>

            <label for="study-subject-filter-pc" class="sr-only">科目で絞り込み</label>
            <select id="study-subject-filter-pc" class="dads-select dads-select--compact">
              <option value="all" ${this.subjectFilter === 'all' ? 'selected' : ''}>全科目</option>
              ${subjects
                .map(
                  (subj) =>
                    `<option value="${escapeHtml(subj)}" ${this.subjectFilter === subj ? 'selected' : ''}>${escapeHtml(subj)}</option>`
                )
                .join('')}
            </select>

            <button
              type="button"
              id="study-shuffle-btn-pc"
              class="dads-button"
              data-type="outline"
              data-size="sm"
              aria-label="カードの順番をシャッフル"
            >
              ${ICONS.shuffle}
              <span>シャッフル</span>
            </button>
          </div>
        </div>

        <!-- スマホ専用：絞り込み適用中のみ最小チップを表示 -->
        ${
          hasFilter
            ? `
          <div class="study-mobile-active-filter">
            <span class="study-mobile-active-filter__text">
              絞り込み中：${this.statusFilter !== 'all' ? STATUS_META[this.statusFilter].label : ''}${this.statusFilter !== 'all' && this.subjectFilter !== 'all' ? ' / ' : ''}${this.subjectFilter !== 'all' ? escapeHtml(this.subjectFilter) : ''}
            </span>
            <button type="button" id="study-mobile-clear-filter" class="dads-button" data-type="text" data-size="sm">
              解除
            </button>
          </div>
        `
            : ''
        }

        <!-- メイン学習カード -->
        <div id="study-stage">
          ${
            currentCard
              ? this._renderCardShellHtml(currentCard, currentIndex, filteredCards.length)
              : this._renderEmptyStateHtml(stats.total)
          }
        </div>
      </div>
    `;

    this._bindControlEvents(filteredCards, currentIndex);

    if (currentCard) {
      this._renderCardDynamicContent();
    }
  }

  _renderEmptyStateHtml(totalCards) {
    if (totalCards === 0) {
      return `
        <div class="empty-state glass-panel">
          <h2 class="dads-heading-md">公式がまだありません</h2>
          <p class="empty-state__desc">「追加」画面から、Gemini で読み取った公式 JSON をインポートしてください。</p>
          <button type="button" id="empty-go-import-btn" class="dads-button" data-type="solid-fill" data-size="md">
            ${ICONS.plus}
            <span>公式を追加する</span>
          </button>
        </div>
      `;
    }
    return `
      <div class="empty-state glass-panel">
        <h2 class="dads-heading-md">該当する公式がありません</h2>
        <p class="empty-state__desc">現在の絞り込み条件に一致するカードは 0 件です。</p>
        <button type="button" id="empty-reset-filter-btn" class="dads-button" data-type="outline" data-size="md">
          <span>絞り込みを解除</span>
        </button>
      </div>
    `;
  }

  _renderCardShellHtml(card, currentIndex, totalFiltered) {
    const canMove = totalFiltered > 1;
    const categoryText = card.category ? `${card.subject} / ${card.category}` : card.subject;

    return `
      <article class="study-card glass-panel" aria-labelledby="study-card-title">
        <header class="study-card__header">
          <span class="dads-chip-label" data-style="filled-1" data-color="blue">${escapeHtml(categoryText)}</span>
          <span class="study-card__counter" aria-label="全${totalFiltered}件中${currentIndex + 1}件目">
            ${currentIndex + 1} / ${totalFiltered}
          </span>
        </header>

        <div class="study-card__question-block">
          <h2 id="study-card-title" class="study-card__title">${escapeHtml(card.title)}</h2>
          ${card.question ? `<p class="study-card__question">${escapeHtml(card.question)}</p>` : ''}
        </div>

        <div id="study-card-dynamic"></div>

        <div class="study-card__footer">
          <div class="status-selector" role="group" aria-label="学習ステータスを記録">
            ${STATUS_ORDER.map((key) => {
              const meta = STATUS_META[key];
              const isSelected = card.status === key;
              return `
                <button
                  type="button"
                  class="status-btn status-btn--${key} ${isSelected ? 'is-selected' : ''}"
                  data-set-status="${key}"
                  aria-pressed="${isSelected ? 'true' : 'false'}"
                >
                  ${meta.icon}
                  <span class="status-btn__full">${meta.label}</span>
                  <span class="status-btn__short" aria-hidden="true">${meta.shortLabel}</span>
                </button>
              `;
            }).join('')}
          </div>

          <nav class="study-card__nav" aria-label="カードの移動">
            <button
              type="button"
              id="study-prev-btn"
              class="dads-button"
              data-type="outline"
              data-size="md"
              ${canMove ? '' : 'disabled'}
            >
              ${ICONS.prev}
              <span>前へ</span>
            </button>

            <button
              type="button"
              id="study-next-btn"
              class="dads-button"
              data-type="solid-fill"
              data-size="md"
              ${canMove ? '' : 'disabled'}
            >
              <span>次の公式</span>
              ${ICONS.next}
            </button>
          </nav>
        </div>
      </article>
    `;
  }

  _renderCardDynamicContent() {
    const dynamicEl = this.root.querySelector('#study-card-dynamic');
    const card = this.store.getById(this.currentCardId);
    if (!dynamicEl || !card) return;

    const isClozeMode = this.studyMode === 'cloze';
    const totalSlots = countCardClozeSlots(card);

    if (isClozeMode) {
      const revealedCount = this.revealedSet.size;
      const allRevealed = totalSlots > 0 && revealedCount >= totalSlots;
      const noneRevealed = revealedCount === 0;

      dynamicEl.innerHTML = `
        <div class="formula-lens" aria-label="公式の数式表示エリア">
          ${
            totalSlots > 0
              ? `<div class="formula-lens__top">
                   <span class="formula-lens__counter" aria-live="polite">${revealedCount} / ${totalSlots} 表示中</span>
                 </div>`
              : ''
          }
          <div id="study-formula-render" class="formula-lens__math"></div>
        </div>

        ${
          card.explanation
            ? `
          <div class="explanation-block">
            <h3 class="explanation-block__heading">解説</h3>
            <div id="study-explanation-render" class="explanation-block__body"></div>
          </div>
        `
            : ''
        }

        ${
          totalSlots > 0
            ? `
          <div class="study-bulk-actions" role="group" aria-label="穴埋めの一括操作">
            <button
              type="button"
              id="study-reveal-all-btn"
              class="dads-button"
              data-type="outline"
              data-size="sm"
              ${allRevealed ? 'disabled' : ''}
            >
              ${ICONS.eye}
              <span>すべて開く</span>
            </button>
            <button
              type="button"
              id="study-hide-all-btn"
              class="dads-button"
              data-type="outline"
              data-size="sm"
              ${noneRevealed ? 'disabled' : ''}
            >
              ${ICONS.eyeOff}
              <span>すべて隠す</span>
            </button>
          </div>
        `
            : ''
        }
      `;

      const formulaEl = dynamicEl.querySelector('#study-formula-render');
      const formulaRes = renderKatexFormula(formulaEl, card.formula, {
        displayMode: true,
        mode: 'cloze',
        revealedSet: this.revealedSet,
        startSlotIndex: 0,
        justToggledSlot: this.justToggledSlot,
        onToggleSlot: (idx, viaKb) => this._handleToggleSlot(idx, viaKb),
      });

      const explanationEl = dynamicEl.querySelector('#study-explanation-render');
      if (explanationEl && card.explanation) {
        renderRichTextExplanation(explanationEl, card.explanation, {
          mode: 'cloze',
          revealedSet: this.revealedSet,
          startSlotIndex: formulaRes.nextSlotIndex,
          justToggledSlot: this.justToggledSlot,
          onToggleSlot: (idx, viaKb) => this._handleToggleSlot(idx, viaKb),
        });
      }

      dynamicEl
        .querySelector('#study-reveal-all-btn')
        ?.addEventListener('click', () => this._handleRevealAll(totalSlots));
      dynamicEl
        .querySelector('#study-hide-all-btn')
        ?.addEventListener('click', () => this._handleHideAll());
    } else {
      dynamicEl.innerHTML = `
        <div class="qa-stage">
          ${
            this.qaAnswerVisible
              ? `
            <div class="formula-lens formula-lens--revealed" aria-label="解答の数式">
              <div class="formula-lens__top">
                <span class="qa-answer-label">解答</span>
              </div>
              <div id="study-formula-render" class="formula-lens__math"></div>
            </div>
            ${
              card.explanation
                ? `
              <div class="explanation-block">
                <h3 class="explanation-block__heading">解説</h3>
                <div id="study-explanation-render" class="explanation-block__body"></div>
              </div>
            `
                : ''
            }
            <div class="study-bulk-actions">
              <button type="button" id="study-qa-toggle-btn" class="dads-button" data-type="outline" data-size="sm">
                ${ICONS.eyeOff}
                <span>答えを隠す</span>
              </button>
            </div>
          `
              : `
            <div class="qa-hidden-box">
              <p class="qa-hidden-box__text">公式を思い浮かべてから確認しましょう</p>
              <button type="button" id="study-qa-toggle-btn" class="dads-button" data-type="solid-fill" data-size="md">
                ${ICONS.eye}
                <span>答えを表示する</span>
              </button>
            </div>
          `
          }
        </div>
      `;

      if (this.qaAnswerVisible) {
        renderKatexFormula(dynamicEl.querySelector('#study-formula-render'), card.formula, {
          displayMode: true,
          mode: 'full',
        });

        const explanationEl = dynamicEl.querySelector('#study-explanation-render');
        if (explanationEl && card.explanation) {
          renderRichTextExplanation(explanationEl, card.explanation, { mode: 'full' });
        }
      }

      dynamicEl.querySelector('#study-qa-toggle-btn')?.addEventListener('click', () => {
        this.qaAnswerVisible = !this.qaAnswerVisible;
        this._renderCardDynamicContent();
        this.callbacks.announce(this.qaAnswerVisible ? '答えを表示しました。' : '答えを隠しました。');
      });
    }
  }

  /**
   * スマホ用ボトムシートの中身を描画＆イベント接続
   */
  _renderOptionsSheet() {
    if (!this.optionsSheet) return;
    const stats = this.store.getStats();
    const subjects = this.store.getSubjects();
    const isClozeMode = this.studyMode === 'cloze';
    const body = this.optionsSheet.querySelector('#study-options-sheet-body');
    if (!body) return;

    body.innerHTML = `
      <div class="sheet-section">
        <p class="dads-form-label">学習モード</p>
        <button
          type="button"
          id="sheet-mode-switch"
          class="dads-switch sheet-mode-switch"
          role="switch"
          aria-checked="${isClozeMode ? 'true' : 'false'}"
        >
          <span class="dads-switch__track" aria-hidden="true">
            <span class="dads-switch__thumb"></span>
          </span>
          <span class="dads-switch__text">
            <span class="dads-switch__label">${isClozeMode ? '穴埋めモード（スタサプ風）' : '通常一問一答モード'}</span>
            <span class="dads-switch__desc">${isClozeMode ? '[ ? ] をタップして1箇所ずつ確認' : '「答えを表示」で全体を確認'}</span>
          </span>
        </button>
      </div>

      <div class="sheet-section">
        <p class="dads-form-label">ステータスで絞り込み</p>
        <div class="sheet-filter-grid">
          ${[
            ['all', `すべて (${stats.total})`],
            ['unlearned', `未習得 (${stats.unlearned})`],
            ['review', `要復習 (${stats.review})`],
            ['mastered', `習得済み (${stats.mastered})`],
          ]
            .map(
              ([val, text]) => `
            <button
              type="button"
              class="filter-pill ${this.statusFilter === val ? 'is-active' : ''}"
              data-sheet-status="${val}"
              aria-pressed="${this.statusFilter === val ? 'true' : 'false'}"
            >${text}</button>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="sheet-section">
        <label for="sheet-subject-select" class="dads-form-label">科目で絞り込み</label>
        <select id="sheet-subject-select" class="dads-select">
          <option value="all" ${this.subjectFilter === 'all' ? 'selected' : ''}>すべての科目</option>
          ${subjects
            .map(
              (subj) =>
                `<option value="${escapeHtml(subj)}" ${this.subjectFilter === subj ? 'selected' : ''}>${escapeHtml(subj)}</option>`
            )
            .join('')}
        </select>
      </div>

      <div class="sheet-actions">
        <button type="button" id="sheet-shuffle-btn" class="dads-button" data-type="outline" data-size="md">
          ${ICONS.shuffle}
          <span>順番をシャッフル</span>
        </button>
        <button type="button" id="sheet-done-btn" class="dads-button" data-type="solid-fill" data-size="md">
          <span>この条件で学習する</span>
        </button>
      </div>
    `;

    body.querySelector('#sheet-mode-switch')?.addEventListener('click', () => {
      this._toggleMode();
      this._renderOptionsSheet();
    });

    body.querySelectorAll('[data-sheet-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.statusFilter = btn.dataset.sheetStatus;
        this.currentCardId = null;
        this.revealedSet = new Set();
        this.qaAnswerVisible = false;
        this.render();
        this._renderOptionsSheet();
      });
    });

    body.querySelector('#sheet-subject-select')?.addEventListener('change', (e) => {
      this.subjectFilter = e.target.value;
      this.currentCardId = null;
      this.revealedSet = new Set();
      this.qaAnswerVisible = false;
      this.render();
    });

    body.querySelector('#sheet-shuffle-btn')?.addEventListener('click', () => {
      this._handleShuffle();
      this.optionsSheet.close();
    });

    body.querySelector('#sheet-done-btn')?.addEventListener('click', () => {
      this.optionsSheet.close();
    });
  }

  _bindControlEvents(filteredCards, currentIndex) {
    this.root.querySelector('#study-mode-switch-pc')?.addEventListener('click', () => {
      this._toggleMode();
    });

    this.root.querySelector('#study-status-filter-pc')?.addEventListener('change', (e) => {
      this.statusFilter = e.target.value;
      this.currentCardId = null;
      this.revealedSet = new Set();
      this.qaAnswerVisible = false;
      this.render();
    });

    this.root.querySelector('#study-subject-filter-pc')?.addEventListener('change', (e) => {
      this.subjectFilter = e.target.value;
      this.currentCardId = null;
      this.revealedSet = new Set();
      this.qaAnswerVisible = false;
      this.render();
    });

    this.root.querySelector('#study-shuffle-btn-pc')?.addEventListener('click', () => {
      this._handleShuffle();
    });

    this.root.querySelector('#study-mobile-clear-filter')?.addEventListener('click', () => {
      this.statusFilter = 'all';
      this.subjectFilter = 'all';
      this.render();
    });

    this.root.querySelector('#empty-reset-filter-btn')?.addEventListener('click', () => {
      this.statusFilter = 'all';
      this.subjectFilter = 'all';
      this.render();
    });

    this.root.querySelector('#empty-go-import-btn')?.addEventListener('click', () => {
      this.callbacks.onNavigateToImport();
    });

    this.root.querySelectorAll('[data-set-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextStatus = btn.dataset.setStatus;
        if (!this.currentCardId) return;
        this.store.setStatus(this.currentCardId, nextStatus);
        this.callbacks.announce(`ステータスを「${STATUS_META[nextStatus].label}」に更新しました。`);
      });
    });

    this.root.querySelector('#study-prev-btn')?.addEventListener('click', () => {
      if (filteredCards.length <= 1) return;
      const prevIdx = (currentIndex - 1 + filteredCards.length) % filteredCards.length;
      this._switchCard(filteredCards[prevIdx]);
    });

    this.root.querySelector('#study-next-btn')?.addEventListener('click', () => {
      if (filteredCards.length <= 1) return;
      const nextIdx = (currentIndex + 1) % filteredCards.length;
      this._switchCard(filteredCards[nextIdx]);
    });
  }
}

/**
 * 「学習する（カード・穴埋め）」タブ コントローラー
 */

import { countCardClozeSlots } from './cloze.js';
import { renderKatexFormula, renderRichTextExplanation } from './katex-renderer.js';
import {
  ICONS,
  STATUS_META,
  STATUS_ORDER,
  escapeHtml,
  renderStatusChipHtml,
} from './ui-helpers.js';

export class StudyView {
  /**
   * @param {HTMLElement} root
   * @param {import('./store.js').FormulaStore} store
   * @param {{ onNavigateToImport: () => void, announce: (msg: string) => void }} callbacks
   */
  constructor(root, store, callbacks) {
    this.root = root;
    this.store = store;
    this.callbacks = callbacks;

    this.statusFilter = 'all'; // 'all' | 'unlearned' | 'review' | 'mastered'
    this.subjectFilter = 'all';
    this.studyMode = store.getStudyMode(); // 'cloze' | 'qa'
    this.shuffledOrder = null; // Array<string> | null
    this.currentCardId = null;

    // 現在のカードの一時的な表示状態
    this.revealedSet = new Set();
    this.qaAnswerVisible = false;
    this.justToggledSlot = null;

    this.render();
  }

  /**
   * 外部（一覧・インポート完了時など）から特定カードを指定して学習開始
   * @param {string} cardId
   */
  focusCard(cardId) {
    const target = this.store.getById(cardId);
    if (!target) {
      this.render();
      return;
    }

    // フィルタで隠れている場合はフィルタを解除して確実に表示
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

  _handleShuffle() {
    const allIds = this.store.getAll().map((c) => c.id);
    for (let i = allIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
    }
    this.shuffledOrder = allIds;
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
      if (nextFocusTarget) {
        nextFocusTarget.focus();
      }
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

    this.root.innerHTML = `
      <section class="study-controls glass-panel" aria-label="学習条件の設定">
        <div class="study-controls__top">
          <div class="study-mode-switch-wrap">
            <div class="dads-switch-group">
              <button
                type="button"
                id="study-mode-switch"
                class="dads-switch"
                role="switch"
                aria-checked="${isClozeMode ? 'true' : 'false'}"
                aria-labelledby="study-mode-label"
                aria-describedby="study-mode-desc"
              >
                <span class="dads-switch__track" aria-hidden="true">
                  <span class="dads-switch__thumb"></span>
                </span>
                <span class="dads-switch__text">
                  <span id="study-mode-label" class="dads-switch__label">
                    ${isClozeMode ? '穴埋めモード（スタサプ風）' : '通常一問一答モード'}
                  </span>
                  <span id="study-mode-desc" class="dads-switch__desc">
                    ${
                      isClozeMode
                        ? '数式の [ ? ] をタップして1箇所ずつ確認できます'
                        : '公式名と問題を見てから「答えを表示」で確認します'
                    }
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div class="study-controls__filters">
            <div class="dads-field-inline">
              <label for="study-subject-filter" class="dads-label-inline">科目</label>
              <select id="study-subject-filter" class="dads-select">
                <option value="all" ${this.subjectFilter === 'all' ? 'selected' : ''}>すべての科目</option>
                ${subjects
                  .map(
                    (subj) =>
                      `<option value="${escapeHtml(subj)}" ${this.subjectFilter === subj ? 'selected' : ''}>${escapeHtml(subj)}</option>`
                  )
                  .join('')}
              </select>
            </div>

            <button type="button" id="study-shuffle-btn" class="dads-button" data-type="outline" data-size="sm">
              ${ICONS.shuffle}
              <span>シャッフル</span>
            </button>
          </div>
        </div>

        <div class="study-status-filter" role="group" aria-label="習得ステータスで絞り込み">
          ${this._renderFilterButton('all', 'すべて', stats.total)}
          ${this._renderFilterButton('unlearned', '未習得', stats.unlearned)}
          ${this._renderFilterButton('review', '復習が必要', stats.review)}
          ${this._renderFilterButton('mastered', '習得済み', stats.mastered)}
        </div>
      </section>

      <div id="study-stage">
        ${
          currentCard
            ? this._renderCardShellHtml(currentCard, currentIndex, filteredCards.length, isClozeMode)
            : this._renderEmptyStateHtml(stats.total)
        }
      </div>
    `;

    this._bindControlEvents(filteredCards, currentIndex);

    if (currentCard) {
      this._renderCardDynamicContent();
    }
  }

  _renderFilterButton(value, label, count) {
    const active = this.statusFilter === value;
    return `
      <button
        type="button"
        class="filter-pill ${active ? 'is-active' : ''}"
        data-filter-status="${value}"
        aria-pressed="${active ? 'true' : 'false'}"
      >
        <span>${label}</span>
        <span class="filter-pill__count">${count}</span>
      </button>
    `;
  }

  _renderEmptyStateHtml(totalCards) {
    if (totalCards === 0) {
      return `
        <div class="empty-state glass-panel">
          <h2 class="dads-heading-md">登録されている公式がありません</h2>
          <p class="empty-state__desc">「公式を追加（JSON取込）」タブから、Geminiで読み取った公式をインポートしてください。</p>
          <button type="button" id="empty-go-import-btn" class="dads-button" data-type="solid-fill" data-size="md">
            ${ICONS.plus}
            <span>公式を追加する</span>
          </button>
        </div>
      `;
    }
    return `
      <div class="empty-state glass-panel">
        <h2 class="dads-heading-md">条件に一致する公式はありません</h2>
        <p class="empty-state__desc">選択中のステータスまたは科目に該当するカードが0件です。絞り込みを解除してください。</p>
        <button type="button" id="empty-reset-filter-btn" class="dads-button" data-type="outline" data-size="md">
          <span>絞り込みをすべて解除</span>
        </button>
      </div>
    `;
  }

  _renderCardShellHtml(card, currentIndex, totalFiltered, isClozeMode) {
    const hasPrev = totalFiltered > 1;
    const hasNext = totalFiltered > 1;

    return `
      <article class="study-card glass-panel" aria-labelledby="study-card-title">
        <header class="study-card__header">
          <div class="study-card__meta">
            <span class="dads-chip-label" data-style="filled-1" data-color="blue">${escapeHtml(card.subject)}</span>
            ${
              card.category
                ? `<span class="dads-chip-label" data-style="outlined" data-color="gray">${escapeHtml(card.category)}</span>`
                : ''
            }
          </div>
          <div class="study-card__progress-meta">
            <span class="study-card__counter" aria-label="全${totalFiltered}件中${currentIndex + 1}件目">
              ${currentIndex + 1} / ${totalFiltered}
            </span>
            ${renderStatusChipHtml(card.status)}
          </div>
        </header>

        <div class="study-card__question-block">
          <h2 id="study-card-title" class="study-card__title">${escapeHtml(card.title)}</h2>
          ${
            card.question
              ? `<p class="study-card__question">${escapeHtml(card.question)}</p>`
              : ''
          }
        </div>

        <div id="study-card-dynamic"></div>

        <div class="study-card__status-section">
          <p class="study-card__section-label" id="status-group-label">学習ステータスを記録</p>
          <div class="status-selector" role="group" aria-labelledby="status-group-label">
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
                  <span>${meta.label}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <nav class="study-card__nav" aria-label="カードの移動">
          <button
            type="button"
            id="study-prev-btn"
            class="dads-button"
            data-type="outline"
            data-size="md"
            ${hasPrev ? '' : 'disabled'}
          >
            ${ICONS.prev}
            <span>前の公式</span>
          </button>

          <span class="study-card__nav-hint">
            ${isClozeMode ? 'タップで個別開閉' : '一問一答'}
          </span>

          <button
            type="button"
            id="study-next-btn"
            class="dads-button"
            data-type="solid-fill"
            data-size="md"
            ${hasNext ? '' : 'disabled'}
          >
            <span>次の公式</span>
            ${ICONS.next}
          </button>
        </nav>
      </article>
    `;
  }

  /**
   * 数式エリア・解説エリア・一括開閉ボタンのみを再描画（スロット開閉時の高速・フォーカス維持更新）
   */
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
          <div class="formula-lens__hint">
            <span>${totalSlots > 0 ? 'オレンジの [ ? ] をタップするとその箇所だけ答えが表示されます' : 'この公式には穴埋め箇所がありません'}</span>
            ${
              totalSlots > 0
                ? `<span class="formula-lens__counter" aria-live="polite">表示中: <strong>${revealedCount}</strong> / ${totalSlots}</span>`
                : ''
            }
          </div>
          <div id="study-formula-render" class="formula-lens__math"></div>
        </div>

        ${
          card.explanation
            ? `
          <div class="explanation-box">
            <h3 class="explanation-box__heading">ポイント・解説</h3>
            <div id="study-explanation-render" class="explanation-box__body"></div>
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
              data-size="md"
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
              data-size="md"
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

      const revealAllBtn = dynamicEl.querySelector('#study-reveal-all-btn');
      const hideAllBtn = dynamicEl.querySelector('#study-hide-all-btn');
      revealAllBtn?.addEventListener('click', () => this._handleRevealAll(totalSlots));
      hideAllBtn?.addEventListener('click', () => this._handleHideAll());
    } else {
      // 通常一問一答モード
      dynamicEl.innerHTML = `
        <div class="qa-stage">
          ${
            this.qaAnswerVisible
              ? `
            <div class="formula-lens formula-lens--revealed" aria-label="解答の数式">
              <div class="formula-lens__hint">
                <span class="qa-answer-label">解答</span>
              </div>
              <div id="study-formula-render" class="formula-lens__math"></div>
            </div>
            ${
              card.explanation
                ? `
              <div class="explanation-box">
                <h3 class="explanation-box__heading">ポイント・解説</h3>
                <div id="study-explanation-render" class="explanation-box__body"></div>
              </div>
            `
                : ''
            }
            <div class="study-bulk-actions">
              <button type="button" id="study-qa-toggle-btn" class="dads-button" data-type="outline" data-size="md">
                ${ICONS.eyeOff}
                <span>答えを隠す</span>
              </button>
            </div>
          `
              : `
            <div class="qa-hidden-box">
              <p class="qa-hidden-box__text">頭の中で公式を思い浮かべてから、下のボタンで答え合わせをしましょう。</p>
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
        const formulaEl = dynamicEl.querySelector('#study-formula-render');
        renderKatexFormula(formulaEl, card.formula, {
          displayMode: true,
          mode: 'full',
        });

        const explanationEl = dynamicEl.querySelector('#study-explanation-render');
        if (explanationEl && card.explanation) {
          renderRichTextExplanation(explanationEl, card.explanation, {
            mode: 'full',
          });
        }
      }

      const qaToggleBtn = dynamicEl.querySelector('#study-qa-toggle-btn');
      qaToggleBtn?.addEventListener('click', () => {
        this.qaAnswerVisible = !this.qaAnswerVisible;
        this._renderCardDynamicContent();
        this.callbacks.announce(this.qaAnswerVisible ? '答えを表示しました。' : '答えを隠しました。');
      });
    }
  }

  _bindControlEvents(filteredCards, currentIndex) {
    const modeSwitch = this.root.querySelector('#study-mode-switch');
    modeSwitch?.addEventListener('click', () => {
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
    });

    const subjectSelect = this.root.querySelector('#study-subject-filter');
    subjectSelect?.addEventListener('change', (e) => {
      this.subjectFilter = e.target.value;
      this.currentCardId = null;
      this.revealedSet = new Set();
      this.qaAnswerVisible = false;
      this.render();
    });

    const shuffleBtn = this.root.querySelector('#study-shuffle-btn');
    shuffleBtn?.addEventListener('click', () => this._handleShuffle());

    this.root.querySelectorAll('[data-filter-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.statusFilter = btn.dataset.filterStatus;
        this.currentCardId = null;
        this.revealedSet = new Set();
        this.qaAnswerVisible = false;
        this.render();
      });
    });

    this.root.querySelector('#empty-reset-filter-btn')?.addEventListener('click', () => {
      this.statusFilter = 'all';
      this.subjectFilter = 'all';
      this.render();
    });

    this.root.querySelector('#empty-go-import-btn')?.addEventListener('click', () => {
      this.callbacks.onNavigateToImport();
    });

    // ステータス更新ボタン
    this.root.querySelectorAll('[data-set-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextStatus = btn.dataset.setStatus;
        if (!this.currentCardId) return;
        this.store.setStatus(this.currentCardId, nextStatus);
        const label = STATUS_META[nextStatus]?.label || nextStatus;
        this.callbacks.announce(`ステータスを「${label}」に更新しました。`);
      });
    });

    // 前後ナビゲーション
    const prevBtn = this.root.querySelector('#study-prev-btn');
    const nextBtn = this.root.querySelector('#study-next-btn');

    prevBtn?.addEventListener('click', () => {
      if (filteredCards.length <= 1) return;
      const prevIdx = (currentIndex - 1 + filteredCards.length) % filteredCards.length;
      this._switchCard(filteredCards[prevIdx]);
    });

    nextBtn?.addEventListener('click', () => {
      if (filteredCards.length <= 1) return;
      const nextIdx = (currentIndex + 1) % filteredCards.length;
      this._switchCard(filteredCards[nextIdx]);
    });
  }
}

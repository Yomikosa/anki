/**
 * 「ホーム」画面コントローラー
 * - 学習進捗のひと目確認とワンタップ学習開始
 * - 科目別・ステータス別のクイック起動デッキ
 * - APIキー不要の3ステップ利用ガイド（折りたたみ式でノイズを抑止）
 */

import { ICONS, escapeHtml } from './ui-helpers.js';

export class HomeView {
  /**
   * @param {HTMLElement} root
   * @param {import('./store.js').FormulaStore} store
   * @param {{
   *   onStartStudy: (opts?: { status?: string, subject?: string, shuffle?: boolean }) => void,
   *   onNavigateToImport: () => void,
   *   onNavigateToManage: () => void
   * }} callbacks
   */
  constructor(root, store, callbacks) {
    this.root = root;
    this.store = store;
    this.callbacks = callbacks;
    this.render();
  }

  _getSubjectSummaries() {
    const cards = this.store.getAll();
    const map = new Map();
    for (const card of cards) {
      const subj = card.subject || '未分類';
      if (!map.has(subj)) {
        map.set(subj, { subject: subj, total: 0, mastered: 0, review: 0 });
      }
      const entry = map.get(subj);
      entry.total++;
      if (card.status === 'mastered') entry.mastered++;
      if (card.status === 'review') entry.review++;
    }
    return Array.from(map.values());
  }

  _getPrimaryAction(stats) {
    if (stats.total === 0) {
      return {
        label: '公式を追加してはじめる',
        hint: '参考書の写真から Gemini で JSON を作成して取り込めます。',
        action: 'import',
      };
    }
    if (stats.review > 0) {
      return {
        label: `要復習の公式を学習（${stats.review}件）`,
        hint: '「復習が必要」に設定した公式から優先して確認しましょう。',
        action: 'study-review',
      };
    }
    if (stats.unlearned > 0) {
      return {
        label: `未習得の公式を学習（${stats.unlearned}件）`,
        hint: 'タップ穴埋めで重要箇所を1つずつ定着させましょう。',
        action: 'study-unlearned',
      };
    }
    return {
      label: `全${stats.total}件をランダム復習`,
      hint: 'すべての公式が習得済みです。総復習で記憶を定着させましょう。',
      action: 'study-shuffle',
    };
  }

  render() {
    const stats = this.store.getStats();
    const subjects = this._getSubjectSummaries();
    const primary = this._getPrimaryAction(stats);

    this.root.innerHTML = `
      <div class="home-layout">
        <!-- メインヒーロー＆進捗 -->
        <section class="home-hero glass-panel" aria-labelledby="home-hero-heading">
          <div class="home-hero__body">
            <p class="home-hero__eyebrow">公式暗記帳・スタサプ風タップ穴埋め</p>
            <h2 id="home-hero-heading" class="home-hero__title">今日の公式暗記</h2>
            <p class="home-hero__desc">${escapeHtml(primary.hint)}</p>

            <div class="home-progress-block" aria-label="全体の習得率 ${stats.masteryRate}%">
              <div class="home-progress-block__top">
                <span class="home-progress-block__rate">習得率 <strong>${stats.masteryRate}%</strong></span>
                <span class="home-progress-block__counts">
                  <span>習得 <strong>${stats.mastered}</strong></span>
                  <span aria-hidden="true">・</span>
                  <span>要復習 <strong>${stats.review}</strong></span>
                  <span aria-hidden="true">・</span>
                  <span>未習得 <strong>${stats.unlearned}</strong></span>
                </span>
              </div>
              <div class="dads-progress-track" role="progressbar" aria-valuenow="${stats.masteryRate}" aria-valuemin="0" aria-valuemax="100">
                <div class="dads-progress-bar" style="width: ${stats.masteryRate}%"></div>
              </div>
            </div>

            <div class="home-hero__actions">
              <button
                type="button"
                id="home-primary-cta"
                class="dads-button"
                data-type="solid-fill"
                data-size="md"
                data-home-cta="${primary.action}"
              >
                ${primary.action === 'import' ? ICONS.plus : ICONS.study}
                <span>${escapeHtml(primary.label)}</span>
              </button>

              <button
                type="button"
                id="home-add-cta"
                class="dads-button"
                data-type="outline"
                data-size="md"
              >
                ${ICONS.plus}
                <span>公式を追加（JSON）</span>
              </button>
            </div>
          </div>
        </section>

        <!-- クイック学習デッキ -->
        <section class="home-section" aria-labelledby="home-decks-heading">
          <div class="home-section__head">
            <h2 id="home-decks-heading" class="dads-heading-sm">科目・状態から学習</h2>
            <button type="button" id="home-goto-manage-btn" class="dads-button" data-type="text" data-size="sm">
              <span>一覧を見る</span>
            </button>
          </div>

          <div class="home-deck-grid">
            <button
              type="button"
              id="home-quiz-deck-btn"
              class="deck-card deck-card--quiz glass-panel"
              data-deck-quiz="true"
              ${stats.total === 0 ? 'disabled' : ''}
            >
              <div class="deck-card__top">
                <span class="deck-card__title">4択穴埋めクイズ</span>
                <span class="deck-card__count">クイズ</span>
              </div>
              <span class="deck-card__sub">選択肢から正しい数式を選んで公式を完成</span>
            </button>

            <button type="button" class="deck-card glass-panel" data-deck-status="all">
              <div class="deck-card__top">
                <span class="deck-card__title">すべての公式</span>
                <span class="deck-card__count">${stats.total}件</span>
              </div>
              <span class="deck-card__sub">順番通りにすべてのカードを確認</span>
            </button>

            <button
              type="button"
              class="deck-card deck-card--warning glass-panel"
              data-deck-status="review"
              ${stats.review === 0 ? 'disabled' : ''}
            >
              <div class="deck-card__top">
                <span class="deck-card__title">復習が必要な公式</span>
                <span class="deck-card__count">${stats.review}件</span>
              </div>
              <span class="deck-card__sub">${stats.review > 0 ? '苦手な公式だけを集中チェック' : '現在、復習待ちはありません'}</span>
            </button>

            ${subjects
              .map(
                (item) => `
              <button type="button" class="deck-card glass-panel" data-deck-subject="${escapeHtml(item.subject)}">
                <div class="deck-card__top">
                  <span class="deck-card__title">${escapeHtml(item.subject)}</span>
                  <span class="deck-card__count">${item.total}件</span>
                </div>
                <span class="deck-card__sub">習得 ${item.mastered} / ${item.total}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </section>

        <!-- 使い方ガイド（折りたたみ式で画面をすっきり保つ） -->
        <section class="home-section" aria-label="アプリの使い方">
          <details class="dads-disclosure glass-panel">
            <summary class="dads-disclosure__summary">
              <span>APIキー不要・Gemini連携の使い方（3ステップ）</span>
            </summary>
            <ol class="home-guide-steps">
              <li><strong>プロンプトをコピー</strong>：「追加」画面で AI読み取り用プロンプトをワンクリックコピーします。</li>
              <li><strong>Gemini に写真を送信</strong>：普段お使いの Gemini に参考書の写真とプロンプトを貼って送信します。</li>
              <li><strong>JSON を貼って暗記開始</strong>：出力された JSON を貼り付けると、数式の穴埋めカードが自動作成されます。</li>
            </ol>
          </details>
        </section>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    this.root.querySelector('#home-primary-cta')?.addEventListener('click', (e) => {
      const action = e.currentTarget.dataset.homeCta;
      if (action === 'import') {
        this.callbacks.onNavigateToImport();
      } else if (action === 'study-review') {
        this.callbacks.onStartStudy({ status: 'review', subject: 'all', shuffle: false });
      } else if (action === 'study-unlearned') {
        this.callbacks.onStartStudy({ status: 'unlearned', subject: 'all', shuffle: false });
      } else {
        this.callbacks.onStartStudy({ status: 'all', subject: 'all', shuffle: true });
      }
    });

    this.root.querySelector('#home-add-cta')?.addEventListener('click', () => {
      this.callbacks.onNavigateToImport();
    });

    this.root.querySelector('#home-goto-manage-btn')?.addEventListener('click', () => {
      this.callbacks.onNavigateToManage();
    });

    this.root.querySelector('[data-deck-quiz]')?.addEventListener('click', () => {
      this.callbacks.onStartStudy({
        status: 'all',
        subject: 'all',
        shuffle: false,
        mode: 'quiz',
      });
    });

    this.root.querySelectorAll('[data-deck-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onStartStudy({
          status: btn.dataset.deckStatus,
          subject: 'all',
          shuffle: false,
        });
      });
    });

    this.root.querySelectorAll('[data-deck-subject]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onStartStudy({
          status: 'all',
          subject: btn.dataset.deckSubject,
          shuffle: false,
        });
      });
    });
  }
}

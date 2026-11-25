/**
 * アプリケーションエントリーポイント
 * - 4画面構成（ホーム / 学習する / 公式を追加 / 一覧・管理）
 * - PC用左サイドバーナビゲーション ＆ スマホ用トップバー＋ボトムナビゲーションの完全同期
 */

import { FormulaStore } from './store.js';
import { HomeView } from './ui-home.js';
import { StudyView } from './ui-study.js';
import { ImportView } from './ui-import.js';
import { ManageView } from './ui-manage.js';
import { ICONS } from './ui-helpers.js';

const VIEW_META = {
  home: { pcTitle: 'ホーム', mobileTitle: '公式暗記帳' },
  study: { pcTitle: '学習する', mobileTitle: '学習' },
  import: { pcTitle: '公式を追加（JSON取込）', mobileTitle: '公式を追加' },
  manage: { pcTitle: '登録済み一覧・管理', mobileTitle: '一覧・管理' },
};

function initApp() {
  const store = new FormulaStore();
  const liveRegion = document.getElementById('sr-live-region');

  const announce = (message) => {
    if (!liveRegion) return;
    liveRegion.textContent = '';
    requestAnimationFrame(() => {
      liveRegion.textContent = message;
    });
  };

  let activeView = 'home';
  let latestStudyMeta = { counterText: '', hasActiveFilter: false, mode: store.getStudyMode() };

  const navButtons = Array.from(document.querySelectorAll('[data-nav-target]'));
  const panels = Array.from(document.querySelectorAll('[data-view-panel]'));
  const pcPageTitle = document.getElementById('pc-page-title');
  const mobileBarTitle = document.getElementById('mobile-bar-title');
  const mobileBarAction = document.getElementById('mobile-bar-action');

  // スマホ用学習設定シートの閉じるボタン
  document.getElementById('sheet-close-btn')?.addEventListener('click', () => {
    document.getElementById('study-options-sheet')?.close();
  });

  const updateMobileTopBar = () => {
    const meta = VIEW_META[activeView] || VIEW_META.home;
    if (pcPageTitle) pcPageTitle.textContent = meta.pcTitle;

    if (mobileBarTitle) {
      if (activeView === 'study' && latestStudyMeta.counterText) {
        const prefix =
          latestStudyMeta.mode === 'quiz'
            ? 'クイズ'
            : latestStudyMeta.mode === 'qa'
              ? '一問一答'
              : '学習';
        mobileBarTitle.textContent = `${prefix} ${latestStudyMeta.counterText}`;
      } else {
        mobileBarTitle.textContent = meta.mobileTitle;
      }
    }

    if (!mobileBarAction) return;
    mobileBarAction.innerHTML = '';

    if (activeView === 'study') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'mobile-study-options-btn';
      btn.className = `mobile-action-btn ${latestStudyMeta.hasActiveFilter ? 'has-indicator' : ''}`;
      btn.setAttribute('aria-label', '学習モードと絞り込み設定を開く');
      btn.innerHTML = `${ICONS.sliders}<span>条件</span>`;
      btn.addEventListener('click', () => studyView.openOptionsSheet());
      mobileBarAction.appendChild(btn);
    } else if (activeView === 'manage') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'mobile-manage-add-btn';
      btn.className = 'mobile-action-btn mobile-action-btn--primary';
      btn.setAttribute('aria-label', '手動で公式を追加');
      btn.innerHTML = `${ICONS.plus}<span>追加</span>`;
      btn.addEventListener('click', () => manageView.openCreateModal());
      mobileBarAction.appendChild(btn);
    } else if (activeView === 'home') {
      const stats = store.getStats();
      const pill = document.createElement('span');
      pill.className = 'mobile-rate-pill';
      pill.textContent = `習得 ${stats.masteryRate}%`;
      mobileBarAction.appendChild(pill);
    }
  };

  const navigateTo = (targetName) => {
    if (!VIEW_META[targetName]) return;
    activeView = targetName;

    navButtons.forEach((btn) => {
      const isCurrent = btn.dataset.navTarget === targetName;
      btn.setAttribute('aria-current', isCurrent ? 'page' : 'false');
      btn.classList.toggle('is-active', isCurrent);
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.viewPanel !== targetName;
    });

    if (targetName === 'home') homeView.render();
    else if (targetName === 'study') studyView.render();
    else if (targetName === 'manage') manageView.render();

    updateMobileTopBar();
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      navigateTo(btn.dataset.navTarget);
    });
  });

  // 各画面のコントローラーを初期化
  const homeView = new HomeView(document.getElementById('view-home'), store, {
    onStartStudy: (opts) => {
      studyView.startSession(opts);
      navigateTo('study');
    },
    onNavigateToImport: () => navigateTo('import'),
    onNavigateToManage: () => navigateTo('manage'),
  });

  const studyView = new StudyView(document.getElementById('view-study'), store, {
    onNavigateToImport: () => navigateTo('import'),
    onStudyMetaChange: (meta) => {
      latestStudyMeta = meta;
      if (activeView === 'study') updateMobileTopBar();
    },
    announce,
  });

  new ImportView(document.getElementById('view-import'), store, {
    onImportedAndStudy: (firstCardId) => {
      studyView.focusCard(firstCardId);
      navigateTo('study');
    },
    announce,
  });

  const manageView = new ManageView(document.getElementById('view-manage'), store, {
    onStudyCard: (cardId) => {
      studyView.focusCard(cardId);
      navigateTo('study');
    },
    announce,
  });

  // サイドバーとバッジの進捗・件数同期
  const updateChromeStats = () => {
    const stats = store.getStats();
    const pcCount = document.getElementById('pc-nav-manage-count');
    const pcRate = document.getElementById('pc-sidebar-rate');
    const pcBar = document.getElementById('pc-sidebar-bar');
    const pcSub = document.getElementById('pc-sidebar-sub');

    if (pcCount) pcCount.textContent = String(stats.total);
    if (pcRate) pcRate.textContent = `${stats.masteryRate}%`;
    if (pcBar) pcBar.style.width = `${stats.masteryRate}%`;
    if (pcSub) pcSub.textContent = `習得 ${stats.mastered} / 全 ${stats.total} 件`;

    if (activeView === 'home') updateMobileTopBar();
  };

  store.subscribe(() => {
    updateChromeStats();
    if (activeView === 'home') homeView.render();
    else if (activeView === 'study') studyView.render();
    else if (activeView === 'manage') manageView.render();
  });

  updateChromeStats();
  navigateTo('home');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

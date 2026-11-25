/**
 * DADS準拠 UI 共通ヘルパー（アイコンSVG・ステータス定義・ノティフィケーションバナー生成・クリップボード）
 */

export const STATUS_META = {
  mastered: {
    key: 'mastered',
    label: '習得済み',
    shortLabel: '習得済',
    color: 'green',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2"/><path d="M8 12.2L10.8 15L16.5 9.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  review: {
    key: 'review',
    label: '復習が必要',
    shortLabel: '要復習',
    color: 'orange',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4L21 19.5H3L12 4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10V14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.1" fill="currentColor"/></svg>`,
  },
  unlearned: {
    key: 'unlearned',
    label: '未習得',
    shortLabel: '未習得',
    color: 'gray',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" stroke-dasharray="3.5 3"/></svg>`,
  },
};

export const STATUS_ORDER = ['mastered', 'review', 'unlearned'];

export const ICONS = {
  copy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4C2.9 15 2 14.1 2 13V4C2 2.9 2.9 2 4 2H13C14.1 2 15 2.9 15 4V5" stroke="currentColor" stroke-width="2"/></svg>`,
  check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5L10 17.5L19 7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  eye: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12C4.5 7.5 8 5.5 12 5.5C16 5.5 19.5 7.5 22 12C19.5 16.5 16 18.5 12 18.5C8 18.5 4.5 16.5 2 12Z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/></svg>`,
  eyeOff: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M10.6 5.7C11.1 5.6 11.5 5.5 12 5.5C16 5.5 19.5 7.5 22 12C21.1 13.7 19.9 15.1 18.5 16.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6.4 7.3C4.6 8.5 3.1 10.1 2 12C4.5 16.5 8 18.5 12 18.5C13.6 18.5 15.1 18.1 16.5 17.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  shuffle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 3H21V8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 16V21H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 15L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 4L9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  prev: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16.5 3.5L20.5 7.5L8 20H4V16L16.5 3.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7H20M10 11V17M14 11V17M6 7L7 20H17L18 7M9 7V4H15V7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  download: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3V15M12 15L7 10M12 15L17 10M4 19H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sparkle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`,
  info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 10.5V16.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/></svg>`,
  success: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M8 12.2L10.8 15L16.5 9.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3L22 20H2L12 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9.5V14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="17" r="1.1" fill="currentColor"/></svg>`,
  error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M15 9L9 15M9 9L15 15" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  study: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5C4 4.7 4.7 4 5.5 4H11C12.7 4 14 5.3 14 7V20C14 18.9 13.1 18 12 18H5.5C4.7 18 4 17.3 4 16.5V5.5Z" stroke="currentColor" stroke-width="2"/><path d="M20 5.5C20 4.7 19.3 4 18.5 4H13C11.3 4 10 5.3 10 7V20C10 18.9 10.9 18 12 18H18.5C19.3 18 20 17.3 20 16.5V5.5Z" stroke="currentColor" stroke-width="2"/></svg>`,
  home: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 10.5L12 3L21 10.5V20C21 20.6 20.6 21 20 21H15V14.5H9V21H4C3.4 21 3 20.6 3 20V10.5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  list: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 6H20M8 12H20M8 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="6" r="1.25" fill="currentColor"/><circle cx="4" cy="12" r="1.25" fill="currentColor"/><circle cx="4" cy="18" r="1.25" fill="currentColor"/></svg>`,
  sliders: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7H20M4 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="7" r="2.5" fill="var(--dads-white, #fff)" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="17" r="2.5" fill="var(--dads-white, #fff)" stroke="currentColor" stroke-width="2"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};

/**
 * HTMLエスケープ
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * DADSノティフィケーションバナーDOM要素を生成する
 * @param {Object} params
 * @param {'success'|'error'|'warning'|'info'} params.type
 * @param {string} params.heading
 * @param {string|string[]} [params.messages]
 * @param {Array<{ label: string, variant?: 'solid-fill'|'outline'|'text', onClick: () => void }>} [params.actions]
 * @param {boolean} [params.dismissible=false]
 * @returns {HTMLElement}
 */
export function createNotificationBanner({
  type = 'info',
  heading,
  messages = [],
  actions = [],
  dismissible = false,
}) {
  const banner = document.createElement('div');
  banner.className = 'dads-notification-banner';
  banner.dataset.type = type;
  banner.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const iconWrap = document.createElement('span');
  iconWrap.className = 'dads-notification-banner__icon';
  iconWrap.innerHTML = ICONS[type] || ICONS.info;

  const content = document.createElement('div');
  content.className = 'dads-notification-banner__content';

  const headingEl = document.createElement('p');
  headingEl.className = 'dads-notification-banner__heading';
  headingEl.textContent = heading;
  content.appendChild(headingEl);

  const list = Array.isArray(messages) ? messages : messages ? [messages] : [];
  if (list.length === 1) {
    const p = document.createElement('p');
    p.className = 'dads-notification-banner__body';
    p.textContent = list[0];
    content.appendChild(p);
  } else if (list.length > 1) {
    const ul = document.createElement('ul');
    ul.className = 'dads-notification-banner__list';
    for (const msg of list) {
      const li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
    }
    content.appendChild(ul);
  }

  if (actions.length > 0) {
    const actionRow = document.createElement('div');
    actionRow.className = 'dads-notification-banner__actions';
    for (const act of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dads-button';
      btn.dataset.type = act.variant || 'outline';
      btn.dataset.size = 'sm';
      btn.textContent = act.label;
      btn.addEventListener('click', act.onClick);
      actionRow.appendChild(btn);
    }
    content.appendChild(actionRow);
  }

  banner.appendChild(iconWrap);
  banner.appendChild(content);

  if (dismissible) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'dads-notification-banner__close';
    closeBtn.setAttribute('aria-label', '通知を閉じる');
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener('click', () => banner.remove());
    banner.appendChild(closeBtn);
  }

  return banner;
}

/**
 * クリップボードへ安全にテキストをコピー（Clipboard API + フォールバック）
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

/**
 * DADS チップラベル（ステータスバッジ）のHTML文字列を生成
 * @param {'mastered'|'review'|'unlearned'} status
 * @returns {string}
 */
export function renderStatusChipHtml(status) {
  const meta = STATUS_META[status] || STATUS_META.unlearned;
  return `<span class="dads-chip-label" data-style="filled-1" data-color="${meta.color}">${meta.icon}<span>${meta.label}</span></span>`;
}

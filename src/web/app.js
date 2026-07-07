/**
 * フロント制御。グローバル変数を作らないため IIFE でスコープを閉じる。
 * ネイティブ alert/confirm/prompt は使用せず、独自トースト/モーダルで代替する。
 */
(function () {
  'use strict';

  const state = {
    locale: 'ja',
    messages: {},
    rtlLocales: ['ar'],
    categories: [],
  };

  const el = (id) => document.getElementById(id);

  function t(key) {
    return Object.prototype.hasOwnProperty.call(state.messages, key) ? state.messages[key] : key;
  }

  async function fetchJSON(url, options) {
    const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, options));
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  }

  function showToast(message, isError) {
    const toast = el('toast');
    toast.textContent = message;
    toast.classList.toggle('error', Boolean(isError));
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function confirmModal(title, body) {
    return new Promise((resolve) => {
      el('modalTitle').textContent = title;
      el('modalBody').textContent = body;
      el('modalConfirm').textContent = t('action.confirm');
      el('modalCancel').textContent = t('action.cancel');
      const backdrop = el('modalBackdrop');
      backdrop.hidden = false;
      const done = (value) => {
        backdrop.hidden = true;
        el('modalConfirm').onclick = null;
        el('modalCancel').onclick = null;
        resolve(value);
      };
      el('modalConfirm').onclick = () => done(true);
      el('modalCancel').onclick = () => done(false);
    });
  }

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = t(node.getAttribute('data-i18n'));
    });
    document.documentElement.lang = state.locale;
    document.documentElement.dir = state.rtlLocales.indexOf(state.locale) >= 0 ? 'rtl' : 'ltr';
    document.title = `${t('app.title')} - ${t('app.subtitle')}`;
  }

  function levelClass(levelKey) {
    if (levelKey === 'danger') return 'level-danger';
    if (levelKey === 'warning') return 'level-warning';
    if (levelKey === 'safe') return 'level-safe';
    return '';
  }

  function itemLevel(remainingDays) {
    if (remainingDays >= 4) return 'safe';
    if (remainingDays >= 1) return 'warning';
    return 'danger';
  }

  function renderItems(items) {
    const list = el('itemList');
    list.innerHTML = '';
    el('emptyMsg').hidden = items.length > 0;
    items.forEach((item) => {
      const level = itemLevel(item.remainingDays);
      const li = document.createElement('li');
      li.className = `item ${levelClass(level)}`;

      const main = document.createElement('div');
      main.className = 'item-main';

      const name = document.createElement('p');
      name.className = 'item-name';
      name.textContent = item.name || item.categoryName;
      const badges = document.createElement('span');
      badges.className = 'badges';
      if (item.isEstimated) {
        const b = document.createElement('span');
        b.className = 'badge estimated';
        b.textContent = t('badge.estimated');
        badges.appendChild(b);
      }
      if (item.restock) {
        const b = document.createElement('span');
        b.className = 'badge restock';
        b.textContent = t('badge.restock');
        badges.appendChild(b);
      }
      name.appendChild(badges);

      const sub = document.createElement('p');
      sub.className = 'item-sub';
      sub.textContent =
        `${item.categoryName} | ${t('list.expiry')}: ${item.expiryDate} | ` +
        `${t('list.remainingDays')}: ${item.remainingDays}${t('unit.days')} | ` +
        `${t('list.remain')}: ${item.remainPercent}${t('unit.percent')}`;

      const bar = document.createElement('div');
      bar.className = 'remain-bar';
      const fill = document.createElement('div');
      fill.className = 'remain-fill' + (item.remainPercent <= 20 ? ' low' : '');
      fill.style.width = `${item.remainPercent}%`;
      bar.appendChild(fill);

      main.appendChild(name);
      main.appendChild(sub);
      main.appendChild(bar);

      const actions = document.createElement('div');
      actions.className = 'item-actions';
      const num = document.createElement('input');
      num.type = 'number';
      num.min = '0';
      num.max = '100';
      num.value = String(item.remainPercent);
      num.setAttribute('aria-label', t('list.adjustLabel'));

      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'btn';
      apply.innerHTML = `<i class="fa-solid fa-sliders" aria-hidden="true"></i> ${t('list.apply')}`;
      apply.onclick = () => adjustItem(item.id, Number(num.value));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn danger-outline';
      del.innerHTML = `<i class="fa-solid fa-trash" aria-hidden="true"></i> ${t('list.delete')}`;
      del.onclick = () => deleteItem(item.id);

      actions.appendChild(num);
      actions.appendChild(apply);
      actions.appendChild(del);

      li.appendChild(main);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function renderAlert(alert) {
    const led = el('ledIndicator');
    led.className = 'led ' + (alert.ledColor === 'off' ? '' : alert.ledColor);
    el('alertLevel').textContent = t('alert.' + alert.levelKey);
    el('alertMeta').textContent =
      alert.minDays === null ? '' : `${t('alert.minDays')}: ${alert.minDays}${t('unit.days')}`;

    const fanIcon = el('fanIcon');
    fanIcon.classList.toggle('fan-spin', Boolean(alert.fanActivated));
    el('fanState').textContent = alert.fanActivated ? t('alert.fanOn') : t('alert.fanOff');
    el('deviceState').textContent = alert.deviceConnected
      ? t('alert.deviceConnected')
      : t('alert.deviceDisconnected');
  }

  function render(view) {
    if (!view) return;
    renderItems(view.items || []);
    if (view.alert) renderAlert(view.alert);
  }

  function handleApiError(result) {
    if (result.status === 503) {
      showToast(t('error.resetting'), true);
      return;
    }
    if (result.status === 404) {
      showToast(t('error.notFound'), true);
      return;
    }
    if (result.status === 400) {
      showToast(t('error.invalid'), true);
      return;
    }
    showToast(t('error.generic'), true);
  }

  async function refresh() {
    const result = await fetchJSON('/api/state');
    if (result.ok) render(result.body);
    else handleApiError(result);
  }

  async function adjustItem(id, percent) {
    const result = await fetchJSON(`/api/items/${id}/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ percent }),
    });
    if (result.ok) {
      render(result.body);
      showToast(t('toast.adjusted'));
    } else handleApiError(result);
  }

  async function deleteItem(id) {
    const result = await fetchJSON(`/api/items/${id}`, { method: 'DELETE' });
    if (result.ok) {
      render(result.body);
      showToast(t('toast.deleted'));
    } else handleApiError(result);
  }

  function bindRegister() {
    el('registerForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = {
        ocrText: el('ocrText').value,
        name: el('itemName').value,
        website: el('hpWebsite').value,
      };
      const result = await fetchJSON('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        handleApiError(result);
        return;
      }
      if (result.body && result.body.needManual) {
        showToast(t('toast.needManual'), true);
        el('manualExpiry').focus();
        return;
      }
      render(result.body);
      showToast(t('toast.registered'));
      el('registerForm').reset();
    });
  }

  function bindManual() {
    el('manualForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = {
        categoryId: Number(el('manualCategory').value),
        expiryDate: el('manualExpiry').value,
        name: '',
        website: ev.target.querySelector('[name="website"]').value,
      };
      const result = await fetchJSON('/api/items/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (result.ok) {
        render(result.body);
        showToast(t('toast.registered'));
        el('manualForm').reset();
      } else handleApiError(result);
    });
  }

  function bindReset() {
    el('resetBtn').addEventListener('click', async () => {
      const ok = await confirmModal(t('action.confirmResetTitle'), t('action.confirmResetBody'));
      if (!ok) return;
      const result = await fetchJSON('/api/reset', { method: 'POST' });
      if (result.ok) {
        showToast(t('toast.reset'));
        refresh();
      } else handleApiError(result);
    });
  }

  async function loadLocale(locale) {
    const result = await fetchJSON(`./i18n/${locale}.json`);
    if (result.ok && result.body) {
      state.locale = locale;
      state.messages = result.body;
      window.localStorage.setItem('fw_locale', locale);
      applyI18n();
      refresh();
    }
  }

  function buildLangOptions(locales) {
    const sel = el('langSelect');
    sel.innerHTML = '';
    locales.forEach((loc) => {
      const opt = document.createElement('option');
      opt.value = loc;
      opt.textContent = loc.toUpperCase();
      sel.appendChild(opt);
    });
    sel.value = state.locale;
    sel.addEventListener('change', () => loadLocale(sel.value));
  }

  function buildCategoryOptions(categories) {
    const sel = el('manualCategory');
    sel.innerHTML = '';
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
  }

  async function init() {
    const masters = await fetchJSON('/api/masters');
    let locales = ['ja', 'en', 'fr', 'zh', 'ru', 'es', 'ar'];
    if (masters.ok && masters.body) {
      state.categories = masters.body.categories || [];
      state.rtlLocales = masters.body.rtlLocales || state.rtlLocales;
      locales = masters.body.locales || locales;
      buildCategoryOptions(state.categories);
    }
    const saved = window.localStorage.getItem('fw_locale');
    state.locale = saved && locales.indexOf(saved) >= 0 ? saved : 'ja';
    buildLangOptions(locales);
    bindRegister();
    bindManual();
    bindReset();
    await loadLocale(state.locale);
  }

  document.addEventListener('DOMContentLoaded', init);
})();


  const CATEGORIES = [
    { id: 'mercado',    name: 'Mercado',   emo: '🛒', color: '#34d399' },
    { id: 'contas',     name: 'Contas',    emo: '💡', color: '#fbbf24' },
    { id: 'moradia',    name: 'Moradia',   emo: '🏠', color: '#60a5fa' },
    { id: 'transporte', name: 'Transporte',emo: '🚗', color: '#f472b6' },
    { id: 'saude',      name: 'Saúde',     emo: '💊', color: '#fb7185' },
    { id: 'lazer',      name: 'Lazer',     emo: '🎉', color: '#a78bfa' },
    { id: 'comida',     name: 'Comida',    emo: '🍔', color: '#fb923c' },
    { id: 'outros',     name: 'Outros',    emo: '📦', color: '#94a3b8' },
  ];
  const catMap = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
  const CACHE_KEY = 'continha.cache.v1';

  let items = [];          // gastos do mes atual
  let selectedCat = 'mercado';
  let online = true;

  const brl = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const iso = d => d.toISOString().slice(0, 10);
  const today = new Date();

  // ---- Camada de dados: API com fallback/cache no localStorage ----
  const api = {
    async list(month) {
      const r = await fetch('/api/expenses?month=' + month);
      if (!r.ok) throw new Error('list');
      return r.json();
    },
    async add(item) {
      const r = await fetch('/api/expenses', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item) });
      if (!r.ok) throw new Error('add');
      return r.json();
    },
    async remove(id) {
      const r = await fetch('/api/expenses/' + id, { method: 'DELETE' });
      if (!r.ok) throw new Error('remove');
    },
    async setSettled(id, settled) {
      const r = await fetch('/api/expenses/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settled }) });
      if (!r.ok) throw new Error('settle');
      return r.json();
    },
  };
  const cache = {
    all: () => JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'),
    setAll: (arr) => localStorage.setItem(CACHE_KEY, JSON.stringify(arr)),
    forMonth: (month) => cache.all().filter(e => e.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    upsertMonth: (month, list) => { const rest = cache.all().filter(e => e.date.slice(0, 7) !== month); cache.setAll([...rest, ...list]); },
    add: (item) => cache.setAll([...cache.all(), item]),
    update: (id, patch) => cache.setAll(cache.all().map(e => e.id === id ? { ...e, ...patch } : e)),
    remove: (id) => cache.setAll(cache.all().filter(e => e.id !== id)),
  };

  function setStatus(isOnline) {
    online = isOnline;
    const el = document.getElementById('status');
    el.className = 'status ' + (isOnline ? 'online' : 'offline');
    document.getElementById('statusText').textContent = isOnline ? 'Sincronizado na nuvem' : 'Offline (salvo no aparelho)';
  }

  // ---- Elementos / navegacao ----
  const monthPick = document.getElementById('monthPick');
  const catGrid   = document.getElementById('catGrid');
  const form      = document.getElementById('form');
  const submitBtn = document.getElementById('submitBtn');
  monthPick.value = iso(today).slice(0, 7);
  document.getElementById('date').value = iso(today);

  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  const closeSidebar = () => { sidebar.classList.remove('open'); backdrop.classList.remove('show'); };
  document.getElementById('menuBtn').onclick = () => { sidebar.classList.add('open'); backdrop.classList.add('show'); };
  backdrop.onclick = closeSidebar;
  let currentView = 'resumo';
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      currentView = btn.dataset.view;
      document.getElementById('view-' + currentView).classList.add('active');
      closeSidebar();
      if (currentView === 'comparar') loadCompare();
    };
  });
  const goTo = (view) => document.querySelector('.nav-item[data-view="' + view + '"]').click();

  CATEGORIES.forEach(c => {
    const el = document.createElement('div');
    el.className = 'cat' + (c.id === selectedCat ? ' active' : '');
    el.innerHTML = `<span class="emo">${c.emo}</span>${c.name}`;
    el.onclick = () => { selectedCat = c.id; document.querySelectorAll('.cat').forEach(x => x.classList.remove('active')); el.classList.add('active'); };
    catGrid.appendChild(el);
  });

  // ---- Acoes ----
  async function fetchMonth(month) {
    try {
      const l = await api.list(month);
      cache.upsertMonth(month, l);
      setStatus(true);
      return l;
    } catch {
      setStatus(false);
      return cache.forMonth(month);
    }
  }

  async function loadMonth() {
    document.getElementById('list').innerHTML = `<div class="loading">Carregando…</div>`;
    items = await fetchMonth(monthPick.value);
    render();
    if (currentView === 'comparar') loadCompare();
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const desc  = document.getElementById('desc').value.trim();
    const value = parseFloat(document.getElementById('value').value);
    const date  = document.getElementById('date').value;
    if (!desc || !value || value <= 0 || !date) return;
    const payload = { desc, value, date, cat: selectedCat };

    submitBtn.disabled = true; submitBtn.textContent = 'Salvando…';
    try {
      const saved = await api.add(payload);
      cache.add(saved);
      setStatus(true);
    } catch {
      // offline: guarda localmente com id temporario
      cache.add({ id: Date.now(), ...payload });
      setStatus(false);
    }
    submitBtn.disabled = false; submitBtn.textContent = 'Adicionar gasto';
    form.reset();
    document.getElementById('date').value = iso(today);
    await loadMonth();
    goTo('resumo');
  });

  async function removeExpense(id, desc) {
    const nome = desc ? `"${desc}"` : 'este gasto';
    if (!confirm(`Excluir ${nome}? Essa ação não pode ser desfeita.`)) return;
    try { await api.remove(id); setStatus(true); } catch { setStatus(false); }
    cache.remove(id);
    await loadMonth();
  }
  window.removeExpense = removeExpense;

  async function toggleSettled(id, current) {
    const settled = !current;
    // atualiza na hora (otimista)
    const it = items.find(e => e.id === id); if (it) it.settled = settled;
    render();
    try { await api.setSettled(id, settled); setStatus(true); } catch { setStatus(false); }
    cache.update(id, { settled });
  }
  window.toggleSettled = toggleSettled;
  monthPick.addEventListener('change', loadMonth);

  // ---- Render ----
  function catBarsHtml(list, total) {
    const byCat = {};
    list.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + e.value; });
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return `<p style="color:var(--muted);font-size:13px">Sem dados neste mês.</p>`;
    return sorted.map(([id, val]) => {
      const c = catMap[id] || catMap.outros; const pct = total ? (val / total * 100) : 0;
      return `<div class="catbar">
        <div class="top"><span>${c.emo} ${c.name}</span><span class="r">${brl(val)} · ${pct.toFixed(0)}%</span></div>
        <div class="track"><div style="width:${pct}%;background:${c.color}"></div></div>
      </div>`;
    }).join('');
  }

  function render() {
    const month = monthPick.value;
    const list = items;
    const total = list.reduce((s, e) => s + e.value, 0);

    document.getElementById('totalVal').textContent = brl(total);
    document.getElementById('countVal').textContent = list.length;
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrent = month === iso(today).slice(0, 7);
    const daysElapsed = isCurrent ? today.getDate() : daysInMonth;
    document.getElementById('avgVal').textContent = brl(total / daysElapsed).replace(/\,\d{2}$/, '');
    const pago = list.filter(e => e.settled).reduce((s, e) => s + e.value, 0);
    const pendente = total - pago;
    document.getElementById('totalSub').innerHTML = list.length
      ? `✓ ${brl(pago)} pago · ⏳ ${brl(pendente)} pendente` : 'Nenhum gasto ainda';

    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('resumoSub').textContent = 'Visão geral de ' + monthLabel;
    document.getElementById('lancSub').textContent = list.length + ' despesa(s) em ' + monthLabel;

    document.getElementById('catBarsResumo').innerHTML = catBarsHtml(list, total);
    document.getElementById('catBarsFull').innerHTML = catBarsHtml(list, total);

    const listEl = document.getElementById('list');
    if (!list.length) {
      listEl.innerHTML = `<div class="empty"><span class="big">🗒️</span>Nenhum lançamento neste mês.<br>Adicione um gasto em "Novo gasto".</div>`;
      return;
    }
    listEl.innerHTML = list.map(e => {
      const c = catMap[e.cat] || catMap.outros;
      const dstr = new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      const safeDesc = escapeHtml(e.desc).replace(/'/g, "\\'");
      const badge = e.settled ? `<span class="tag pago">✓ Pago</span>` : `<span class="tag pend">Pendente</span>`;
      return `<div class="item${e.settled ? ' settled' : ''}">
        <div class="ic" style="background:${c.color}22;color:${c.color}">${c.emo}</div>
        <div class="info"><div class="d">${escapeHtml(e.desc)}</div><div class="m">${c.name} · ${dstr} ${badge}</div></div>
        <div class="amt">${brl(e.value)}</div>
        <button class="baixa${e.settled ? ' on' : ''}" onclick="toggleSettled(${e.id}, ${e.settled})" title="${e.settled ? 'Marcar como pendente' : 'Dar baixa (marcar como pago)'}" aria-label="Dar baixa">✓</button>
        <button class="del" onclick="removeExpense(${e.id}, '${safeDesc}')" title="Excluir gasto" aria-label="Excluir gasto">🗑️</button>
      </div>`;
    }).join('');
  }

  // ---- Comparar mes atual x mes passado ----
  function prevMonthStr(m) {
    const [y, mo] = m.split('-').map(Number);
    const d = new Date(y, mo - 2, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function monthName(m) {
    const [y, mo] = m.split('-').map(Number);
    const s = new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function deltaInfo(cur, prev) {
    const diff = cur - prev;
    if (Math.abs(diff) < 0.005) return { cls: 'flat', arrow: '—', pctText: '', diff: 0 };
    const up = diff > 0;
    const pctText = prev > 0 ? (up ? '+' : '−') + Math.abs(diff / prev * 100).toFixed(0) + '%' : 'novo';
    return { cls: up ? 'up' : 'down', arrow: up ? '▲' : '▼', pctText, diff };
  }

  async function loadCompare() {
    const cur = monthPick.value;
    const prev = prevMonthStr(cur);
    document.getElementById('compareSummary').innerHTML = `<div class="loading">Carregando…</div>`;
    document.getElementById('compareCats').innerHTML = '';
    const [curList, prevList] = await Promise.all([fetchMonth(cur), fetchMonth(prev)]);
    renderCompare(cur, prev, curList, prevList);
  }

  function renderCompare(cur, prev, curList, prevList) {
    document.getElementById('compareSub').textContent = `${monthName(cur)} (atual) x ${monthName(prev)}`;
    const curTotal = curList.reduce((s, e) => s + e.value, 0);
    const prevTotal = prevList.reduce((s, e) => s + e.value, 0);
    const d = deltaInfo(curTotal, prevTotal);

    let label;
    if (d.cls === 'flat') label = 'Você gastou praticamente o mesmo';
    else if (d.cls === 'up') label = `Gastou ${brl(d.diff)} a mais`;
    else label = `Economizou ${brl(-d.diff)}`;

    document.getElementById('compareSummary').innerHTML = `
      <div class="cmp-tops">
        <div class="cmp-box"><div class="lbl">${monthName(prev)}</div><div class="v">${brl(prevTotal)}</div></div>
        <div class="cmp-box now"><div class="lbl">${monthName(cur)} · atual</div><div class="v">${brl(curTotal)}</div></div>
      </div>
      <div class="cmp-delta ${d.cls}">${d.arrow} ${label} <span class="dpct">${d.pctText}</span></div>`;

    const sumByCat = (arr) => arr.reduce((o, e) => { o[e.cat] = (o[e.cat] || 0) + e.value; return o; }, {});
    const curBy = sumByCat(curList), prevBy = sumByCat(prevList);
    const rows = CATEGORIES.map(c => {
      const a = curBy[c.id] || 0, b = prevBy[c.id] || 0;
      if (!a && !b) return '';
      const dc = deltaInfo(a, b);
      return `<div class="cmp-row">
        <span class="cmp-name">${c.emo} ${c.name}</span>
        <span class="cmp-vals"><b>${brl(b)}</b> → <b>${brl(a)}</b></span>
        <span class="cmp-chip ${dc.cls}">${dc.arrow} ${dc.pctText || '—'}</span>
      </div>`;
    }).join('');
    document.getElementById('compareCats').innerHTML = rows || `<p style="color:var(--muted);font-size:13px">Sem dados para comparar.</p>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  loadMonth();

  // ---- PWA: instalar app ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  const installBtns = [document.getElementById('installBtn'), document.getElementById('installBtnTop')];
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  let deferredPrompt = null;

  const showInstall = (show) => installBtns.forEach(b => { if (b) b.hidden = !show; });

  // Chrome/Edge/Android: prompt nativo
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!isStandalone) showInstall(true);
  });
  window.addEventListener('appinstalled', () => { showInstall(false); deferredPrompt = null; });

  // iOS Safari nao dispara o evento — mostra o botao e ensina o passo a passo
  if (isIOS && !isStandalone) showInstall(true);

  async function doInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      showInstall(false);
    } else if (isIOS) {
      alert('Para instalar no iPhone (Safari):\n\n1. Toque no botão Compartilhar  ⬆️  (na barra de baixo)\n2. Role e escolha "Adicionar à Tela de Início"\n3. Toque em "Adicionar"\n\nPronto! O Continha vira um app na sua tela. 💰');
    } else {
      alert('Para instalar: abra o menu do navegador (⋮) e escolha "Instalar app" ou "Adicionar à tela inicial".');
    }
  }
  installBtns.forEach(b => { if (b) b.onclick = doInstall; });

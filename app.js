(() => {
  'use strict';
  const cfg = window.FEW_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const TABS = ['inicio', 'campeonatos', 'jogos', 'equipes', 'jogadores', 'estatisticas'];

  const state = {
    championships: [],
    updatedAt: null,
    connected: false,
    demo: false,
    activeTab: 'inicio'
  };

  const demoData = {
    championships: [
      {
        id: 'demo-copa',
        name: 'Copa FEW',
        modality: '3V3',
        format: 'MATA-MATA',
        phase: 'MATA-MATA',
        status: 'ACTIVE',
        teams: [
          { id: 't1', name: 'Al-Ahly WPS', players: [{ id: 'p1', name: 'Kareem', pos: 'ATA' }, { id: 'p2', name: 'Tarek', pos: 'MEI' }] },
          { id: 't2', name: 'Zamalek WPS', players: [{ id: 'p3', name: 'Zizo', pos: 'ATA' }] },
          { id: 't3', name: 'Pyramids WPS', players: [{ id: 'p4', name: 'Adel', pos: 'DEF' }] },
          { id: 't4', name: 'Pharaohs United', players: [{ id: 'p5', name: 'Ramses', pos: 'ATA' }] }
        ],
        matches: [
          {
            id: 'm1', round: 1, phase: 'MATA-MATA', homeId: 't1', awayId: 't2',
            homeScore: 2, awayScore: 1, status: 'DONE',
            goals: [
              { playerId: 'p1', playerName: 'Kareem', teamId: 't1' },
              { playerId: 'p2', playerName: 'Tarek', teamId: 't1' },
              { playerId: 'p3', playerName: 'Zizo', teamId: 't2' }
            ],
            assists: [{ playerId: 'p2', playerName: 'Tarek', teamId: 't1' }]
          },
          {
            id: 'm2', round: 1, phase: 'MATA-MATA', homeId: 't3', awayId: 't4',
            homeScore: null, awayScore: null, status: 'PENDING', goals: [], assists: []
          }
        ]
      }
    ]
  };

  const text = (v) => String(v ?? '');
  const esc = (v) => text(v).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const arr = (v) => Array.isArray(v) ? v : [];
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const statusDone = (m) => ['DONE', 'WO', 'FINALIZADO', 'CONCLUIDO', 'CONCLUÍDO'].includes(text(m.status).toUpperCase());
  const champStatus = (c) => text(c.status || c.state || '').toUpperCase();

  function allTeams(champs = state.championships) {
    return champs.flatMap((c) => arr(c.teams).map((t) => ({
      ...t, championshipId: c.id, championshipName: c.name
    })));
  }

  function allMatches(champs = state.championships) {
    return champs.flatMap((c) => arr(c.matches).map((m) => ({
      ...m, championshipId: c.id, championshipName: c.name, _teams: arr(c.teams)
    })));
  }

  function allPlayers(champs = state.championships) {
    return allTeams(champs).flatMap((t) => arr(t.players).map((p) => ({
      ...p,
      teamId: t.id,
      teamName: t.name,
      championshipId: t.championshipId,
      championshipName: t.championshipName
    })));
  }

  function findTeam(m, id) {
    return arr(m._teams).find((t) => t.id === id) || { name: 'Equipe' };
  }

  function scorerId(g) {
    return g.playerId || g.scorerId || (g.player && g.player.id) || '';
  }

  function normalizeStats(champs) {
    const players = new Map();
    const teams = new Map();

    champs.forEach((c) => {
      const teamKey = (id) => `${c.id}::${id}`;
      const playerKey = (id) => `${c.id}::${id}`;

      arr(c.teams).forEach((t) => {
        teams.set(teamKey(t.id), {
          id: t.id, championshipId: c.id, name: t.name, championshipName: c.name,
          gf: 0, ga: 0, played: 0, w: 0, d: 0, l: 0, pts: 0
        });
        arr(t.players).forEach((p) => {
          players.set(playerKey(p.id), {
            id: p.id, championshipId: c.id, teamId: t.id,
            name: p.name, pos: p.pos || 'JOGADOR', team: t.name, championshipName: c.name,
            goals: 0, assists: 0
          });
        });
      });

      arr(c.matches).filter(statusDone).forEach((m) => {
        const home = teams.get(teamKey(m.homeId));
        const away = teams.get(teamKey(m.awayId));
        const hs = num(m.homeScore);
        const as = num(m.awayScore);

        if (home && away) {
          home.played++; away.played++;
          if (text(m.status).toUpperCase() === 'WO' && m.woWinnerId) {
            const winner = m.woWinnerId === m.homeId ? home : away;
            const loser = winner === home ? away : home;
            winner.w++; winner.pts += 3; loser.l++;
          } else {
            home.gf += hs; home.ga += as; away.gf += as; away.ga += hs;
            if (hs > as) { home.w++; home.pts += 3; away.l++; }
            else if (hs < as) { away.w++; away.pts += 3; home.l++; }
            else { home.d++; away.d++; home.pts++; away.pts++; }
          }
        }

        arr(m.goals).forEach((g) => {
          const p = players.get(playerKey(scorerId(g)));
          if (p) p.goals++;
        });
        arr(m.assists).forEach((a) => {
          const p = players.get(playerKey(a.playerId || a.assistId || a.scorerId));
          if (p) p.assists++;
        });
      });
    });

    return {
      players: [...players.values()].sort((a, b) => b.goals - a.goals || b.assists - a.assists),
      teams: [...teams.values()].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga))
    };
  }

  function setTab(tabName, updateHash = true) {
    const target = TABS.includes(tabName) ? tabName : 'inicio';
    state.activeTab = target;

    TABS.forEach((name) => {
      const panel = $(`tab-${name}`);
      if (panel) panel.classList.toggle('active', name === target);
    });

    document.querySelectorAll('[data-tab]').forEach((el) => {
      const isMatch = el.getAttribute('data-tab') === target;
      el.classList.toggle('active', isMatch);
      if (el.getAttribute('role') === 'tab') {
        el.setAttribute('aria-selected', String(isMatch));
      }
    });

    if (updateHash) {
      history.replaceState(null, '', `#${target}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setConnection(label, ok) {
    $('connectionLabel').textContent = label;
    const dot = document.querySelector('.header-right .live-dot');
    if (dot) dot.style.background = ok ? 'var(--green)' : 'var(--red)';
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = `fewCallback_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Tempo esgotado ao consultar o serviço público.'));
      }, 12000);

      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        script.remove();
      }

      window[cb] = (data) => { cleanup(); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('Não foi possível acessar a API pública.')); };
      script.src = url + (url.includes('?') ? '&' : '?') + `callback=${cb}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  async function loadData() {
    if (!cfg.apiUrl) {
      state.championships = demoData.championships;
      state.demo = true;
      state.connected = false;
      setConnection('Prévia demonstrativa', false);
      render();
      return;
    }

    try {
      const response = await jsonp(cfg.apiUrl);
      if (!response || response.ok !== true || !Array.isArray(response.championships)) {
        throw new Error((response && response.error) || 'Resposta inválida da API.');
      }
      state.championships = response.championships;
      state.updatedAt = response.updatedAt || null;
      state.connected = true;
      state.demo = false;
      setConnection('Dados atualizados', true);
      render();
    } catch (err) {
      setConnection('Sem conexão', false);
      toast(err.message);
      if (!state.championships.length) {
        $('champGrid').innerHTML = '<div class="empty-state">Não foi possível carregar os campeonatos. Confira a URL da API pública no arquivo config.js.</div>';
        $('matchList').innerHTML = '<div class="empty-state">Aguardando conexão com o FEW MANAGER.</div>';
      }
    }
  }

  function render() {
    renderSummary();
    renderChampionships();
    renderFilters();
    renderHomeOverview();
    renderMatches();
    renderTeams();
    renderLeaders();
    renderStandings();
    renderPlayers();
  }

  function renderSummary() {
    const teams = allTeams();
    const players = allPlayers();
    const matches = allMatches();
    $('statChamps').textContent = state.championships.length;
    $('statTeams').textContent = teams.length;
    $('statPlayers').textContent = players.length;
    $('statMatches').textContent = matches.length;
  }

  function renderHomeOverview() {
    const matches = allMatches().sort((a, b) => Number(statusDone(b)) - Number(statusDone(a)) || num(b.round) - num(a.round));
    $('homeRecentMatches').innerHTML = matches.length
      ? matches.slice(0, 4).map((m) => {
          const h = findTeam(m, m.homeId);
          const a = findTeam(m, m.awayId);
          const done = statusDone(m);
          const score = done ? `${num(m.homeScore)} : ${num(m.awayScore)}` : 'VS';
          return `<div class="compact-row">
            <span><small>${esc(m.championshipName)}</small><b>${esc(h.name)} × ${esc(a.name)}</b></span>
            <strong class="compact-score ${done ? '' : 'pending'}">${score}</strong>
          </div>`;
        }).join('')
      : '<div class="empty-state">Nenhuma partida registrada.</div>';

    const stats = normalizeStats(state.championships);
    $('homeTopScorers').innerHTML = stats.players.filter((p) => p.goals > 0).slice(0, 4).map((p, i) => `
      <div class="leader-row">
        <span class="leader-rank">${String(i + 1).padStart(2, '0')}</span>
        <span><b class="leader-name">${esc(p.name)}</b><small class="leader-team">${esc(p.team)}</small></span>
        <b class="leader-value">${p.goals}<small style="font:7px var(--font);color:#8c887e"> GOLS</small></b>
      </div>
    `).join('') || '<div class="empty-state">Sem gols registrados.</div>';
  }

  function renderChampionships() {
    const filter = $('champFilter').value;
    const list = state.championships.filter((c) => {
      if (filter === 'all') return true;
      const fin = ['FINISHED', 'FINALIZADO', 'CONCLUIDO'].includes(champStatus(c));
      return filter === 'finished' ? fin : !fin;
    });

    $('champCount').textContent = `${list.length} COMPETIÇÕES`;
    $('champGrid').innerHTML = list.length
      ? list.map((c) => {
          const done = arr(c.matches).filter(statusDone).length;
          const total = arr(c.matches).length;
          const finished = ['FINISHED', 'FINALIZADO', 'CONCLUIDO'].includes(champStatus(c));
          return `<article class="champ-card" tabindex="0">
            <div class="card-top">
              <span class="status ${finished ? 'finished' : total ? '' : 'pending'}">${finished ? 'FINALIZADO' : total ? 'EM COMPETIÇÃO' : 'INSCRIÇÕES / PREPARAÇÃO'}</span>
              <span class="modality">${esc(c.modality || 'WPS')}</span>
            </div>
            <h3>${esc(c.name)}</h3>
            <div class="champ-meta"><span>${esc(c.format || c.phase || 'Campeonato')}</span><span>·</span><span>${arr(c.teams).length} equipes</span></div>
            <div class="champ-footer"><span>${total ? `${done}/${total} partidas concluídas` : 'Aguardando calendário'}</span><b>VER DETALHES ↗</b></div>
          </article>`;
        }).join('')
      : '<div class="empty-state">Nenhum campeonato encontrado.</div>';

    [...$('champGrid').children].forEach((el, i) => {
      if (list[i]) el.addEventListener('click', () => showChamp(list[i]));
    });
  }

  function renderFilters() {
    const opts = '<option value="all">Todos os campeonatos</option>' +
      state.championships.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    ['matchChampFilter', 'statsChampFilter'].forEach((id) => {
      const el = $(id);
      const old = el.value;
      el.innerHTML = opts;
      if ([...el.options].some((o) => o.value === old)) el.value = old;
    });
  }

  function renderMatches() {
    const selectedChamp = $('matchChampFilter').value;
    const selectedStatus = $('matchStatusFilter').value;

    const matches = allMatches()
      .filter((m) => selectedChamp === 'all' || m.championshipId === selectedChamp)
      .filter((m) => {
        if (selectedStatus === 'all') return true;
        return selectedStatus === 'done' ? statusDone(m) : !statusDone(m);
      })
      .sort((a, b) => Number(statusDone(b)) - Number(statusDone(a)) || num(b.round) - num(a.round));

    $('matchSummary').textContent = `${matches.length} PARTIDAS`;
    $('matchList').innerHTML = matches.length
      ? matches.map((m) => {
          const h = findTeam(m, m.homeId);
          const a = findTeam(m, m.awayId);
          const done = statusDone(m);
          const score = done ? `${num(m.homeScore)} : ${num(m.awayScore)}` : 'VS';
          return `<article class="match-card">
            <div class="match-meta"><b>${esc(m.championshipName)}</b>${esc(m.phase || 'Fase')}${m.round ? ' · Rodada ' + esc(m.round) : ''}</div>
            <div class="match-sides">
              <div class="match-team">${esc(h.name)}</div>
              <div class="match-score ${done ? '' : 'pending'}">${score}</div>
              <div class="match-team">${esc(a.name)}</div>
            </div>
            <div class="match-state ${done ? '' : 'pending'}">${done ? 'FINALIZADO' : 'AGENDADO'}</div>
          </article>`;
        }).join('')
      : '<div class="empty-state">Nenhuma partida encontrada com esse filtro.</div>';
  }

  function renderTeams() {
    const q = $('teamSearch').value.trim().toLowerCase();
    const teams = allTeams().filter((t) =>
      t.name.toLowerCase().includes(q) || t.championshipName.toLowerCase().includes(q)
    );

    $('teamGrid').innerHTML = teams.length
      ? teams.map((t) => `<article class="team-card" tabindex="0">
          <div class="team-crest">${esc((t.name || '?').slice(0, 2).toUpperCase())}</div>
          <h3>${esc(t.name)}</h3>
          <p>${arr(t.players).length} jogadores · ${esc(t.championshipName)}</p>
          <div class="team-foot">VER ELENCO E JOGOS ↗</div>
        </article>`).join('')
      : '<div class="empty-state">Nenhuma equipe encontrada.</div>';

    [...$('teamGrid').children].forEach((el, i) => {
      if (teams[i]) el.addEventListener('click', () => showTeam(teams[i]));
    });
  }

  function renderLeaders() {
    const stats = normalizeStats(state.championships);
    const put = (id, list, key, suffix) => {
      $(id).innerHTML = list.filter((p) => p[key] > 0).slice(0, 6).map((p, i) => `
        <div class="leader-row">
          <span class="leader-rank">${String(i + 1).padStart(2, '0')}</span>
          <span><b class="leader-name">${esc(p.name)}</b><small class="leader-team">${esc(p.team)} · ${esc(p.championshipName)}</small></span>
          <b class="leader-value">${p[key]}<small style="font:7px var(--font);color:#8c887e"> ${suffix}</small></b>
        </div>
      `).join('') || '<div class="empty-state">Sem registros até o momento.</div>';
    };
    put('topScorers', stats.players, 'goals', 'GOLS');
    put('topAssists', stats.players, 'assists', 'AST');
  }

  function renderStandings() {
    const id = $('statsChampFilter').value;
    const teams = id === 'all'
      ? normalizeStats(state.championships).teams
      : normalizeStats(state.championships.filter((x) => x.id === id)).teams;

    $('tableTitle').textContent = id === 'all'
      ? 'Tabela geral'
      : (state.championships.find((c) => c.id === id) || {}).name || 'Classificação';

    $('standingsBody').innerHTML = teams.length
      ? teams.map((t, i) => `<tr>
          <td>${i + 1}</td>
          <td>${esc(t.name)}</td>
          <td>${t.played}</td>
          <td>${t.w}</td>
          <td>${t.d}</td>
          <td>${t.l}</td>
          <td>${t.gf - t.ga > 0 ? '+' : ''}${t.gf - t.ga}</td>
          <td><b>${t.pts}</b></td>
        </tr>`).join('')
      : '<tr><td colspan="8" class="table-empty">Ainda não há resultados suficientes para montar a classificação.</td></tr>';

    $('teamGoals').innerHTML = teams.length
      ? teams.slice().sort((a, b) => b.gf - a.gf).slice(0, 8).map((t) => `
          <div class="bar-row">
            <span>${esc(t.name)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (t.gf / Math.max(1, ...teams.map((x) => x.gf))) * 100)}%"></div></div>
            <b class="bar-value">${t.gf}</b>
          </div>
        `).join('')
      : '<div class="table-empty">Aguardando resultados finalizados.</div>';
  }

  function renderPlayers() {
    const q = $('playerSearch').value.trim().toLowerCase();
    const stats = normalizeStats(state.championships).players;
    const players = allPlayers()
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.teamName.toLowerCase().includes(q) || text(p.pos).toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));

    $('playerCount').textContent = `${players.length} JOGADORES`;
    $('playerGrid').innerHTML = players.length
      ? players.map((p) => {
          const st = stats.find((x) => x.id === p.id && x.championshipId === p.championshipId) || {};
          return `<article class="player-card">
            <div class="player-avatar">${esc(p.name.slice(0, 1).toUpperCase())}</div>
            <div>
              <b>${esc(p.name)}</b>
              <small>${esc(p.teamName)} · ${esc(p.pos || 'JOGADOR')}</small>
              <small class="player-meta-sub">${esc(p.championshipName)} · ${num(st.assists)} AST</small>
            </div>
            <div class="player-stats">${num(st.goals)}<small>GOLS</small></div>
          </article>`;
        }).join('')
      : '<div class="empty-state">Nenhum jogador encontrado.</div>';
  }

  function showChamp(c) {
    const done = arr(c.matches).filter(statusDone).length;
    openModal(`
      <div class="eyebrow">CAMPEONATO</div>
      <h2>${esc(c.name)}</h2>
      <p>${esc(c.format || c.phase || 'Competição')} · ${esc(c.modality || 'WPS')}</p>
      <div class="detail-grid">
        <div class="detail-box"><small>EQUIPES</small><b>${arr(c.teams).length}</b></div>
        <div class="detail-box"><small>PARTIDAS CONCLUÍDAS</small><b>${done}/${arr(c.matches).length}</b></div>
        <div class="detail-box"><small>FASE</small><b>${esc(c.phase || '—')}</b></div>
        <div class="detail-box"><small>STATUS</small><b>${esc(c.status || 'Em andamento')}</b></div>
      </div>
      <h3 style="margin-top:24px">Equipes participantes</h3>
      <p>${arr(c.teams).map((t) => esc(t.name)).join(' · ') || 'Nenhuma equipe cadastrada.'}</p>
    `);
  }

  function showTeam(t) {
    const champ = state.championships.find((c) => c.id === t.championshipId);
    const pStats = normalizeStats(champ ? [champ] : state.championships).players;
    const teamMatches = allMatches(champ ? [champ] : state.championships)
      .filter((m) => m.homeId === t.id || m.awayId === t.id);

    openModal(`
      <div class="eyebrow">EQUIPE · ${esc(t.championshipName)}</div>
      <h2>${esc(t.name)}</h2>
      <p>Elenco (${arr(t.players).length} atletas) e confrontos no campeonato.</p>
      <div class="detail-grid">
        ${arr(t.players).map((p) => {
          const st = pStats.find((x) => x.id === p.id) || { goals: 0, assists: 0 };
          return `<div class="detail-box">
            <small>${esc(p.pos || 'JOGADOR')}</small>
            <b>${esc(p.name)}</b>
            <span class="modal-substat">${num(st.goals)} GOLS · ${num(st.assists)} AST</span>
          </div>`;
        }).join('') || '<p>Elenco não informado.</p>'}
      </div>
      <h3 style="margin-top:24px">Partidas da equipe</h3>
      <div class="modal-matches">
        ${teamMatches.length ? teamMatches.map((m) => {
          const h = findTeam({ _teams: champ ? champ.teams : t._teams || [] }, m.homeId);
          const a = findTeam({ _teams: champ ? champ.teams : t._teams || [] }, m.awayId);
          const pl = statusDone(m) ? `${num(m.homeScore)} : ${num(m.awayScore)}` : 'VS';
          return `<div class="modal-match-row"><span>${esc(h.name)}</span><b>${pl}</b><span>${esc(a.name)}</span></div>`;
        }).join('') : '<p>Nenhuma partida cadastrada para esta equipe.</p>'}
      </div>
    `);
  }

  function openModal(html) {
    $('modalContent').innerHTML = html;
    $('detailModal').classList.add('open');
    $('detailModal').setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    $('detailModal').classList.remove('open');
    $('detailModal').setAttribute('aria-hidden', 'true');
  }

  let toastTimer;
  function toast(msg) {
    $('toast').textContent = msg;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3200);
  }

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (btn.tagName === 'A') e.preventDefault();
      setTab(btn.getAttribute('data-tab'));
    });
  });

  document.querySelectorAll('[data-go-tab]').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.getAttribute('data-go-tab')));
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (TABS.includes(hash)) setTab(hash, false);
  });

  $('champFilter').addEventListener('change', renderChampionships);
  $('matchChampFilter').addEventListener('change', renderMatches);
  $('matchStatusFilter').addEventListener('change', renderMatches);
  $('statsChampFilter').addEventListener('change', renderStandings);
  $('teamSearch').addEventListener('input', renderTeams);
  $('playerSearch').addEventListener('input', renderPlayers);
  $('refreshBtn').addEventListener('click', loadData);
  $('detailModal').addEventListener('click', (e) => { if (e.target.matches('[data-close]')) closeModal(); });
  $('champGrid').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('champ-card')) e.target.click();
  });
  $('year').textContent = new Date().getFullYear();

  const initialTab = window.location.hash.replace('#', '');
  setTab(TABS.includes(initialTab) ? initialTab : 'inicio', false);
  loadData();
  if (cfg.apiUrl && num(cfg.refreshSeconds) > 0) {
    setInterval(loadData, Math.max(10, num(cfg.refreshSeconds)) * 1000);
  }
})();

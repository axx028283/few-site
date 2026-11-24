(() => {
  'use strict';
  const cfg = window.FEW_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const state = { championships: [], updatedAt: null, connected: false, demo: false };
  const demoData = {
    championships: [{id:'demo-copa',name:'Copa FEW',modality:'3V3',format:'MATA-MATA',phase:'MATA-MATA',status:'ACTIVE',teams:[{id:'t1',name:'Al-Ahly WPS',players:[{id:'p1',name:'Kareem',pos:'ATA'},{id:'p2',name:'Tarek',pos:'MEI'}]},{id:'t2',name:'Zamalek WPS',players:[{id:'p3',name:'Zizo',pos:'ATA'}]},{id:'t3',name:'Pyramids WPS',players:[{id:'p4',name:'Adel',pos:'DEF'}]},{id:'t4',name:'Pharaohs United',players:[{id:'p5',name:'Ramses',pos:'ATA'}]}],matches:[{id:'m1',round:1,phase:'MATA-MATA',homeId:'t1',awayId:'t2',homeScore:2,awayScore:1,status:'DONE',goals:[{playerId:'p1',playerName:'Kareem',teamId:'t1'},{playerId:'p2',playerName:'Tarek',teamId:'t1'},{playerId:'p3',playerName:'Zizo',teamId:'t2'}],assists:[{playerId:'p2',playerName:'Tarek',teamId:'t1'}]},{id:'m2',round:1,phase:'MATA-MATA',homeId:'t3',awayId:'t4',homeScore:null,awayScore:null,status:'PENDING',goals:[],assists:[]}]}],activeChampId:'demo-copa'
  };
  const text = (v) => String(v ?? '');
  const esc = (v) => text(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arr = (v) => Array.isArray(v) ? v : [];
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const statusDone = (m) => ['DONE','WO','FINALIZADO','CONCLUIDO','CONCLUÍDO'].includes(text(m.status).toUpperCase());
  const champStatus = (c) => text(c.status || c.state || '').toUpperCase();
  function allTeams(champs = state.championships) { return champs.flatMap(c => arr(c.teams).map(t => ({...t, championshipId:c.id, championshipName:c.name}))); }
  function allMatches(champs = state.championships) { return champs.flatMap(c => arr(c.matches).map(m => ({...m, championshipId:c.id, championshipName:c.name, _teams:arr(c.teams)}))); }
  function allPlayers(champs = state.championships) { return allTeams(champs).flatMap(t => arr(t.players).map(p => ({...p, teamId:t.id, teamName:t.name, championshipName:t.championshipName}))); }
  function findTeam(m, id) { return arr(m._teams).find(t => t.id === id) || {name:'Equipe'}; }
  function scorerName(g) { return g.playerName || g.scorerName || g.name || (g.player && g.player.name) || 'Jogador'; }
  function scorerId(g) { return g.playerId || g.scorerId || (g.player && g.player.id) || ''; }
  function normalizeStats(champs) {
    const players = new Map();
    const teams = new Map();
    champs.forEach(c => {
      const teamKey = id => `${c.id}::${id}`;
      const playerKey = id => `${c.id}::${id}`;
      arr(c.teams).forEach(t => {
        teams.set(teamKey(t.id), {id:t.id,name:t.name,championshipName:c.name,gf:0,ga:0,played:0,w:0,d:0,l:0,pts:0});
        arr(t.players).forEach(p => players.set(playerKey(p.id),{id:p.id,name:p.name,team:t.name,championshipName:c.name,goals:0,assists:0}));
      });
      arr(c.matches).filter(statusDone).forEach(m => {
        const home=teams.get(teamKey(m.homeId)), away=teams.get(teamKey(m.awayId));
        const hs=num(m.homeScore), as=num(m.awayScore);
        if(home&&away){
          home.played++;away.played++;
          if(text(m.status).toUpperCase()==='WO' && m.woWinnerId){
            const winner=m.woWinnerId===m.homeId?home:away;
            const loser=winner===home?away:home;
            winner.w++;winner.pts+=3;loser.l++;
          } else {
            home.gf+=hs;home.ga+=as;away.gf+=as;away.ga+=hs;
            if(hs>as){home.w++;home.pts+=3;away.l++;}else if(hs<as){away.w++;away.pts+=3;home.l++;}else{home.d++;away.d++;home.pts++;away.pts++;}
          }
        }
        arr(m.goals).forEach(g=>{const p=players.get(playerKey(scorerId(g)));if(p)p.goals++;});
        arr(m.assists).forEach(a=>{const p=players.get(playerKey(a.playerId||a.assistId||a.scorerId));if(p)p.assists++;});
      });
    });
    return {players:[...players.values()].sort((a,b)=>b.goals-a.goals||b.assists-a.assists),teams:[...teams.values()].sort((a,b)=>b.pts-a.pts||(b.gf-b.ga)-(a.gf-a.ga))};
  }
  function setConnection(label, ok) { $('connectionLabel').textContent=label; const dot=document.querySelector('.header-right .live-dot'); if(dot)dot.style.background=ok?'var(--green)':'var(--red)'; }
  function jsonp(url) { return new Promise((resolve,reject)=>{ const cb='fewCallback_'+Date.now()+'_'+Math.floor(Math.random()*1e6); const script=document.createElement('script'); const timer=setTimeout(()=>{cleanup();reject(new Error('Tempo esgotado ao consultar o serviço público.'));},12000); function cleanup(){clearTimeout(timer);delete window[cb];script.remove();} window[cb]=(data)=>{cleanup();resolve(data);}; script.onerror=()=>{cleanup();reject(new Error('Não foi possível acessar a API pública.'));}; script.src=url+(url.includes('?')?'&':'?')+'callback='+cb+'&_='+Date.now(); document.head.appendChild(script); }); }
  async function loadData() {
    if(!cfg.apiUrl){state.championships=demoData.championships;state.demo=true;state.connected=false;setConnection('Prévia demonstrativa',false);render();return;}
    try { const response=await jsonp(cfg.apiUrl); if(!response||response.ok!==true||!Array.isArray(response.championships))throw new Error(response&&response.error||'Resposta inválida da API.'); state.championships=response.championships;state.updatedAt=response.updatedAt||null;state.connected=true;state.demo=false;setConnection('Dados atualizados',true);render(); }
    catch(err){setConnection('Sem conexão',false);toast(err.message);if(!state.championships.length){$('champGrid').innerHTML='<div class="empty-state">Não foi possível carregar os campeonatos. Confira a URL da API pública no arquivo config.js.</div>'; $('matchList').innerHTML='<div class="empty-state">Aguardando conexão com o FEW MANAGER.</div>';}}
  }
  function render(){ renderSummary();renderChampionships();renderFilters();renderMatches();renderTeams();renderLeaders();renderStandings();renderPlayers(); }
  function renderSummary(){const teams=allTeams(),players=allPlayers(),matches=allMatches();$('statChamps').textContent=state.championships.length;$('statTeams').textContent=teams.length;$('statPlayers').textContent=players.length;$('statMatches').textContent=matches.length;}
  function renderChampionships(){const filter=$('champFilter').value;const list=state.championships.filter(c=>filter==='all'||(filter==='finished'?['FINISHED','FINALIZADO','CONCLUIDO'].includes(champStatus(c)):!['FINISHED','FINALIZADO','CONCLUIDO'].includes(champStatus(c))));$('champCount').textContent=list.length+' COMPETIÇÕES';$('champGrid').innerHTML=list.length?list.map(c=>{const done=arr(c.matches).filter(statusDone).length,total=arr(c.matches).length;const finished=['FINISHED','FINALIZADO','CONCLUIDO'].includes(champStatus(c));return `<article class="champ-card"><div class="card-top"><span class="status ${finished?'finished':total?'':'pending'}">${finished?'FINALIZADO':total?'EM COMPETIÇÃO':'INSCRIÇÕES / PREPARAÇÃO'}</span><span class="modality">${esc(c.modality||'WPS')}</span></div><h3>${esc(c.name)}</h3><div class="champ-meta"><span>${esc(c.format||c.phase||'Campeonato')}</span><span>·</span><span>${arr(c.teams).length} equipes</span></div><div class="champ-footer"><span>${total?`${done}/${total} partidas concluídas`:'Aguardando calendário'}</span><b>VER DETALHES ↗</b></div></article>`;}).join(''):'<div class="empty-state">Nenhum campeonato encontrado.</div>';[...$('champGrid').children].forEach((el,i)=>{if(list[i])el.addEventListener('click',()=>showChamp(list[i]));});}
  function renderFilters(){const opts='<option value="all">Todos os campeonatos</option>'+state.championships.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');['matchChampFilter','statsChampFilter'].forEach(id=>{const el=$(id),old=el.value;el.innerHTML=opts;if([...el.options].some(o=>o.value===old))el.value=old;});}
  function renderMatches(){const selected=$('matchChampFilter').value;const matches=allMatches().filter(m=>selected==='all'||m.championshipId===selected).sort((a,b)=>Number(statusDone(b))-Number(statusDone(a))||num(b.round)-num(a.round));$('matchSummary').textContent=matches.length+' PARTIDAS';$('matchList').innerHTML=matches.length?matches.slice(0,18).map(m=>{const h=findTeam(m,m.homeId),a=findTeam(m,m.awayId),done=statusDone(m),score=done?`${num(m.homeScore)} : ${num(m.awayScore)}`:'VS';return `<article class="match-card"><div class="match-meta"><b>${esc(m.championshipName)}</b>${esc(m.phase||'Fase')}${m.round?' · Rodada '+esc(m.round):''}</div><div class="match-sides"><div class="match-team">${esc(h.name)}</div><div class="match-score ${done?'':'pending'}">${score}</div><div class="match-team">${esc(a.name)}</div></div><div class="match-state ${done?'':'pending'}">${done?'FINALIZADO':'AGENDADO'}</div></article>`;}).join(''):'<div class="empty-state">Nenhuma partida cadastrada.</div>';}
  function renderTeams(){const q=$('teamSearch').value.trim().toLowerCase(),teams=allTeams().filter(t=>t.name.toLowerCase().includes(q));$('teamGrid').innerHTML=teams.length?teams.map(t=>`<article class="team-card" tabindex="0"><div class="team-crest">${esc((t.name||'?').slice(0,2).toUpperCase())}</div><h3>${esc(t.name)}</h3><p>${arr(t.players).length} jogadores · ${esc(t.championshipName)}</p><div class="team-foot">VER EQUIPE ↗</div></article>`).join(''):'<div class="empty-state">Nenhuma equipe encontrada.</div>';[...$('teamGrid').children].forEach((el,i)=>{if(teams[i])el.addEventListener('click',()=>showTeam(teams[i]));});}
  function renderLeaders(){const stats=normalizeStats(state.championships);const put=(id,list,key,suffix)=>$(id).innerHTML=list.filter(p=>p[key]>0).slice(0,5).map((p,i)=>`<div class="leader-row"><span class="leader-rank">${String(i+1).padStart(2,'0')}</span><span><b class="leader-name">${esc(p.name)}</b><small class="leader-team">${esc(p.team)}</small></span><b class="leader-value">${p[key]}<small style="font:7px var(--font);color:#8c887e"> ${suffix}</small></b></div>`).join('')||'<div class="empty-state">Sem registros até o momento.</div>';put('topScorers',stats.players,'goals','GOLS');put('topAssists',stats.players,'assists','AST');}
  function renderStandings(){const id=$('statsChampFilter').value;let teams=[];if(id==='all'){teams=normalizeStats(state.championships).teams;}else{const c=state.championships.find(x=>x.id===id);teams=normalizeStats(c?[c]:[]).teams;}$('tableTitle').textContent=id==='all'?'Tabela geral':(state.championships.find(c=>c.id===id)||{}).name||'Classificação';$('standingsBody').innerHTML=teams.length?teams.map((t,i)=>`<tr><td>${i+1}</td><td>${esc(t.name)}</td><td>${t.played}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td><td>${t.gf-t.ga>0?'+':''}${t.gf-t.ga}</td><td><b>${t.pts}</b></td></tr>`).join(''):'<tr><td colspan="8" class="table-empty">Ainda não há resultados suficientes para montar a classificação.</td></tr>';$('teamGoals').innerHTML=teams.length?teams.slice().sort((a,b)=>b.gf-a.gf).slice(0,7).map(t=>`<div class="bar-row"><span>${esc(t.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3,t.gf/Math.max(1,...teams.map(x=>x.gf))*100)}%"></div></div><b class="bar-value">${t.gf}</b></div>`).join(''):'<div class="table-empty">Aguardando resultados finalizados.</div>';}
  function renderPlayers(){const players=allPlayers().sort((a,b)=>a.name.localeCompare(b.name));const stats=normalizeStats(state.championships).players;$('playerCount').textContent=players.length+' JOGADORES';$('playerGrid').innerHTML=players.length?players.slice(0,16).map(p=>{const st=stats.find(x=>x.id===p.id)||{};return `<article class="player-card"><div class="player-avatar">${esc(p.name.slice(0,1).toUpperCase())}</div><div><b>${esc(p.name)}</b><small>${esc(p.teamName)} · ${esc(p.pos||'JOGADOR')}</small></div><div class="player-stats">${num(st.goals)}<small>GOLS</small></div></article>`;}).join(''):'<div class="empty-state">Nenhum jogador cadastrado.</div>';}
  function showChamp(c){const done=arr(c.matches).filter(statusDone).length;openModal(`<div class="eyebrow">CAMPEONATO</div><h2>${esc(c.name)}</h2><p>${esc(c.format||c.phase||'Competição')} · ${esc(c.modality||'WPS')}</p><div class="detail-grid"><div class="detail-box"><small>EQUIPES</small><b>${arr(c.teams).length}</b></div><div class="detail-box"><small>PARTIDAS CONCLUÍDAS</small><b>${done}/${arr(c.matches).length}</b></div><div class="detail-box"><small>FASE</small><b>${esc(c.phase||'—')}</b></div><div class="detail-box"><small>STATUS</small><b>${esc(c.status||'Em andamento')}</b></div></div><h3 style="margin-top:24px">Equipes participantes</h3><p>${arr(c.teams).map(t=>esc(t.name)).join(' · ')||'Nenhuma equipe cadastrada.'}</p>`);}
  function showTeam(t){openModal(`<div class="eyebrow">EQUIPE · ${esc(t.championshipName)}</div><h2>${esc(t.name)}</h2><p>Elenco cadastrado no campeonato.</p><div class="detail-grid">${arr(t.players).map(p=>`<div class="detail-box"><small>${esc(p.pos||'JOGADOR')}</small><b>${esc(p.name)}</b></div>`).join('')||'<p>Elenco não informado.</p>'}</div>`);}
  function openModal(html){$('modalContent').innerHTML=html;$('detailModal').classList.add('open');$('detailModal').setAttribute('aria-hidden','false');}
  function closeModal(){$('detailModal').classList.remove('open');$('detailModal').setAttribute('aria-hidden','true');}
  let toastTimer;function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
  $('champFilter').addEventListener('change',renderChampionships);$('matchChampFilter').addEventListener('change',renderMatches);$('statsChampFilter').addEventListener('change',renderStandings);$('teamSearch').addEventListener('input',renderTeams);$('refreshBtn').addEventListener('click',loadData);$('mobileMenu').addEventListener('click',()=>$('mainNav').classList.toggle('open'));$('mainNav').addEventListener('click',e=>{if(e.target.closest('a'))$('mainNav').classList.remove('open');});$('detailModal').addEventListener('click',e=>{if(e.target.matches('[data-close]'))closeModal();});$('champGrid').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.classList.contains('champ-card'))e.target.click();});$('year').textContent=new Date().getFullYear();
  loadData();if(cfg.apiUrl&&num(cfg.refreshSeconds)>0)setInterval(loadData,Math.max(10,num(cfg.refreshSeconds))*1000);
})();

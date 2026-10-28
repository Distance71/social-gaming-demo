/* Presentation only. All outcomes, legal moves and payouts belong to the licensed Hub. */
(() => {
  'use strict';
  const config = JSON.parse(document.getElementById('arcade-config').textContent);
  const m = config.mechanic, $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n || 0).toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2});
  const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let phase='loading', info={}, view={}, last=null, busy=false, pending=null, flightTimer=null, cashoutQueued=false;
  let picks=new Set(), wheelAngle=0;
  const betActions = {crash:'Launch',plinko:'Drop ball',mines:'Enter mine',tower:'Enter vault',keno:'Draw numbers',wheel:'Spin wheel',dice:'Roll',limbo:'Launch',blackjack:'Deal hand',hilo:'Play card'};
  const ruleText = {
    crash:'Live flight: cash out before the server crash. Auto cashout is committed with your wager and survives disconnection. A crash exactly at your auto target loses. No decorative delay is added to cashout.',
    plinko:'Every peg sends the ball left or right using the committed server outcome. Bin returns depend on rows and risk. The journey takes at least 3.2 seconds; it never changes the payout.',
    mines:'25 chambers. Choose 1–24 mines before entering. Each safe crystal increases the available return. Reveal at least one safe chamber before collecting. A mine ends the round.',
    tower:'Seven floors, three doors per floor, one unsafe door per floor. Choose one door at a time. Complete at least one safe floor before collecting. The seventh safe floor collects automatically.',
    keno:'Choose exactly five numbers from 1–40. Ten unique numbers are drawn. The table lists total-return multipliers by hits. Draw order is presentation only.',
    wheel:'Every displayed segment is equally likely. The published multiplier is the total return, including the wager. There are no hidden jackpot segments.',
    dice:'A uniform numeric roll from 0.00 to 99.99, not the sum of two dice. Under wins strictly below the target; Over wins strictly above it. Equality loses.',
    limbo:'Choose a fixed target from 1.01× to 1000× before launch. The server determines reached or missed. This is not live Crash: there is no mid-flight cashout.',
    blackjack:'Cards are independently drawn with replacement. Dealer draws below 17 and stands on all 17s. Win returns 1.90×, push 1.00×, loss 0×. No 3:2 bonus, split, double or insurance. Hitting 21 completes the hand.',
    hilo:'Ranks run 2 through Ace; suits do not affect the outcome. Choose strictly higher or lower than the preview card. Equal ranks lose. Cards are independently drawn; the next preview is prepared without a wager.'
  };
  document.documentElement.style.setProperty('--accent',config.accent);
  document.documentElement.style.setProperty('--secondary',config.secondary);
  document.documentElement.style.setProperty('--cover',`url('/cedar/games/${config.id}/cover.png')`);
  $('arcade').innerHTML = `<header><div><span class="brand">CEDAR</span> <span class="eyebrow">/ ORIGINALS</span></div><div class="wallet"><small>Cedar Coins</small><b id="balance">—</b></div></header><main class="layout"><div class="heading"><div><div class="eyebrow">THE ORIGINAL COLLECTION</div><h1>${esc(config.title)}</h1><p>${esc(config.tagline)}</p></div><span class="badge">SERVER-COMMITTED PLAY</span></div><div class="shell"><aside class="panel"><div class="field"><label for="wager">Wager · Cedar Coins</label><input id="wager" type="number" value="10" min="10" step="0.01" inputmode="decimal"></div><div id="settings"></div><button id="play" class="primary" disabled>Opening game…</button><div id="active-actions" class="actions"></div><button id="recover" class="secondary hidden">Recover existing round</button><p id="message" role="status" aria-live="polite"></p><p class="rulehint">Results stay on the table. A new round button places one new wager — never an automatic replay.</p><details><summary>Rules & returns</summary><p>${ruleText[m]}</p><p>Maximum total return: 1,000,000 coins. Published payouts are total returns, not net profit. Rounding and the cap can reduce the effective return.</p><div id="paytable" class="paytable"></div></details><details><summary>Round receipt & fairness</summary><p id="reference">No completed round.</p><button id="verify" disabled>Verify latest round</button><pre id="proof"></pre></details></aside><section><div class="stage"><div class="stagebar"><span id="stage-label">Awaiting secure session</span><b id="stage-info">${esc(m)}</b></div><div id="scene"></div><div class="result" aria-live="polite"><div><small id="result-label">Your next move</small><strong class="outcome" id="outcome">Take your time</strong></div><div><small>Return</small><strong id="return">—</strong></div><div><small>Net change</small><strong id="net">—</strong></div></div></div><div class="foot"><span id="round-ref">No wager placed</span><span id="timing">${config.reveal_ms ? (config.reveal_ms/1000)+'s reveal' : 'Live server flight'}</span></div></section></div></main><footer>CEDAR ORIGINALS · FREE CEDAR COINS · NO AUTOMATIC REBET</footer>`;
  function field(id,label,value,min,max,step=1) { return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></div>`; }
  function select(id,label,options) { return `<div class="field"><label for="${id}">${label}</label><select id="${id}">${options.map(([value,text])=>`<option value="${value}">${text}</option>`).join('')}</select></div>`; }
  let settings='';
  if (['plinko','wheel'].includes(m)) settings+=select('risk','Risk',[['medium','Balanced'],['low','Low'],['high','High']]);
  if (m==='plinko') settings+=select('rows','Rows',[[16,16],[12,12],[8,8]]);
  if (m==='wheel') settings+=select('segments','Segments',[[10,10],[20,20]]);
  if (m==='mines') settings+=field('mines','Mines in 25 chambers',3,1,24);
  if (m==='crash') settings+=field('auto_cashout','Auto cashout · 0 = manual',2,0,1000,.01);
  if (m==='limbo') settings+=field('target','Target multiplier',2,1.01,1000,.01);
  if (m==='dice') settings+=field('target','Target · roll 0.00–99.99',50,1,98,.01)+select('condition','Win when',[['under','Strictly under'],['over','Strictly over']]);
  if (m==='hilo') settings+=`<div id="preview" class="hand"></div>`+select('choice','Prediction',[['higher','Higher'],['lower','Lower']]);
  if (m==='keno') settings+='<p class="rulehint" id="ticket">Pick five numbers on the main board.</p>';
  $('settings').innerHTML=settings;
  const number=id=>Number($(id)?.value), value=id=>$(id)?.value;
  function state(next) {
    phase=next; const locked=!['ready','result'].includes(phase);
    document.querySelectorAll('.panel input,.panel select').forEach(el=>el.disabled=locked);
    $('play').disabled=locked || busy || (m==='keno' && picks.size!==5);
    $('play').textContent=phase==='result' ? `${m==='blackjack'?'Deal again':'New round'} · ${money(number('wager'))}` : phase==='ready'?`${betActions[m]} · ${money(number('wager'))}`:phase==='active'?'Round in progress':phase==='revealing'?'Revealing outcome…':phase==='error'?'Recovery needed':'Confirming…';
    $('stage-label').textContent={ready:'Ready when you are',result:'Round complete · result retained',active:'Round in progress',revealing:'Revealing committed outcome',error:'Recovering your place',submitting:'Confirming with server',loading:'Opening secure session'}[phase];
    $('recover').classList.toggle('hidden',phase!=='error');
    activeButtons();if(m==='keno')ticket();
  }
  function activeButtons() {
    const host=$('active-actions'); host.innerHTML='';
    if (phase!=='active') return;
    const add=(text,action,disabled=false)=> {const b=document.createElement('button');b.textContent=text;b.disabled=disabled || (busy&&m!=='crash');b.onclick=()=>move(action);host.append(b);};
    if (m==='blackjack') {add('Hit','hit');add('Stand','stand');}
    if (['mines','tower','crash'].includes(m)) add(m==='crash'?'Cash out':`Collect ${money(view.current_win)}`,'cashout',m==='mines'?!view.revealed?.length:m==='tower'?!view.level:false);
  }
  function parameters() {
    const p={wager:value('wager'),server_seed_hash:info.server_seed_hash,client_seed:info.client_seed};
    for (const id of ['risk','rows','segments','mines','auto_cashout','target','condition','choice']) if ($(id)) p[id]=['risk','condition','choice'].includes(id)?value(id):number(id);
    if(m==='keno') p.picks=Array.from(picks).sort((a,b)=>a-b);
    return p;
  }
  async function request(action,payload={}) {
    const command={...payload,command_id:uid()}; pending={action,payload:command};
    return PromexHtmlGame.request(action,command);
  }
  function fail(error) {
    clearTimeout(flightTimer); cashoutQueued=false; busy=false; state('error');
    $('message').textContent=error.message+' Recover checks the existing command; it does not place another wager.';
  }
  function updateInfo(r) {
    if(r.balance!==undefined) $('balance').textContent=money(r.balance);
    if(r.next_server_seed_hash) info.server_seed_hash=r.next_server_seed_hash;
    if(r.client_seed) info.client_seed=r.client_seed;
  }
  async function initialize() {
    if(busy)return;busy=true;state('loading');
    try {
      const r=await request('init'); pending=null; info=r; updateInfo(r);
      $('wager').min=r.min_bet; $('wager').max=r.max_bet;
      if(number('wager')<r.min_bet) $('wager').value=r.min_bet;
      view=r.active_game||r.last_result||{}; last=r.last_result||null;
      if(view.wager) $('wager').value=view.wager;
      if(r.active_game){
        $('round-ref').textContent='Round '+view.bet_id;
        $('result-label').textContent='Wager '+money(view.wager);
        $('outcome').textContent='Round in progress';
        if(m==='mines'&&view.mines_count) $('mines').value=view.mines_count;
        if(m==='crash'&&view.auto_cashout!==undefined) $('auto_cashout').value=view.auto_cashout;
      } else if(last?.proof?.parameters){
        for(const [key,setting] of Object.entries(last.proof.parameters)) if($(key)&&typeof setting!=='object') $(key).value=setting;
      }
      if(m==='keno' && last?.proof?.parameters?.picks) picks=new Set(last.proof.parameters.picks);
      busy=false;
      if(r.active_game){state('active');render(view);if(m==='crash')poll();}
      else if(last){state('result');render(last);receipt(last);}
      else{state('ready');render({});}
      preview();paytable();$('message').textContent='';
    }catch(e){fail(e);}
  }
  async function start() {
    if(busy||!['ready','result'].includes(phase))return;
    if(!$('wager').checkValidity()||Array.from(document.querySelectorAll('#settings input')).some(el=>!el.checkValidity())){$('message').textContent='Check the wager and settings.';return;}
    if(m==='keno'&&picks.size!==5){$('message').textContent='Pick exactly five numbers.';return;}
    busy=true;state('submitting');if(m==='keno')keno(last||{});$('message').textContent='';
    try {
      const r=await request(config.action,parameters());pending=null;updateInfo(r);
      view=r;$('return').textContent='—';$('net').textContent='—';$('outcome').textContent='Round in progress';
      $('round-ref').textContent='Round '+r.bet_id;
      if(r.proof) await reveal(r,config.action);
      else { if(m==='blackjack'){state('revealing');await deal(r,{});} busy=false;state('active');render(r);if(m==='crash')poll(); }
    }catch(e){fail(e);}
  }
  async function move(action,extra={}) {
    if(phase!=='active')return;
    if(busy){if(m==='crash'&&action==='cashout')cashoutQueued=true;return;}
    clearTimeout(flightTimer);busy=true;activeButtons(); const before=view;
    try {
      const r=await request(action,{bet_id:view.bet_id,...extra});pending=null;updateInfo(r);view=r;
      if(r.proof) await reveal(r,action,before);
      else {
        if(m==='blackjack') {state('revealing');await deal(r,before);}
        else if(m!=='crash') {state('revealing');render(r);await animate(config.reveal_ms);}
        busy=false;state('active');render(r);
        if(m==='crash'){if(cashoutQueued){cashoutQueued=false;move('cashout');}else poll();}
      }
    }catch(e){fail(e);}
  }
  function poll(){clearTimeout(flightTimer);flightTimer=setTimeout(()=>move('status'),400);}
  // A hidden tab pauses presentation only; the private server still settles live flights.
  function animate(duration,frame=()=>{}) {
    return new Promise((resolve,reject)=>{
      let elapsed=0,prior=performance.now();
      function tick(now){
        try {
          // rAF's frame-start timestamp can predate this animation's start.
          if(!document.hidden)elapsed+=Math.min(Math.max(0,now-prior),100);
          prior=Math.max(prior,now);
          const t=Math.max(0,Math.min(1,elapsed/Math.max(1,duration)));
          frame(t);
          if(t<1)requestAnimationFrame(tick);else resolve();
        } catch(error) { reject(error); }
      }
      requestAnimationFrame(tick);
    });
  }
  async function reveal(r,action,before={}) {
    state('revealing');
    if(m==='plinko') {if($('plinko-label'))$('plinko-label').textContent='Following the committed path…';await animate(config.reveal_ms,t=>plinko(r,reduced?0:t));}
    else if(m==='wheel') {wheel(r,false);const end=wheelAngle+360*4+((360-r.winning_index*360/r.segments_count-180/r.segments_count-wheelAngle%360+360)%360);const from=wheelAngle;
      await animate(config.reveal_ms,t=>{$('wheel-disc').style.transform=`rotate(${reduced?from:from+(end-from)*(1-Math.pow(1-t,4))}deg)`;});wheelAngle=end;}
    else if(m==='keno') {await animate(config.reveal_ms,t=>keno(r,Math.floor(t*10)));}
    else if(m==='blackjack') await deal(r,before);
    else if(m==='hilo') {cardsHilo(r,false);await animate(config.reveal_ms);}
    else if(m==='limbo') {limbo(r,0);await animate(Math.max(4000,config.reveal_ms),t=>limbo(r,t));}
    else if(m==='dice') {render({pending:true,target:r.target});await animate(config.reveal_ms);}
    else if(m!=='crash'){render(r);await animate(config.reveal_ms);}
    view=r;last=r;busy=false;state('result');render(r);receipt(r);paytable();
    if(m==='hilo') {
      // Prepare the next visible card in the background. Keep the completed hand in the scene.
      $('play').disabled=true;
      try { const init=await request('init');pending=null;info=init;updateInfo(init);preview();state('result'); }
      catch(e){fail(e);}
    }
  }
  function receipt(r) {
    const net=Number(r.win_amount)-Number(r.wager);
    $('result-label').textContent=`Wager ${money(r.wager)}`;
    $('outcome').textContent=net>0?'Round won':net===0?'Wager returned':Number(r.win_amount)>0?'Partial return':'Round lost';
    $('return').textContent=money(r.win_amount);$('net').textContent=(net>0?'+':'')+money(net);$('net').className=net>0?'net-positive':net<0?'net-negative':'';
    for(const id of ['return','net']) $(id).classList.toggle('long-amount',$(id).textContent.length>9);
    $('round-ref').textContent='Round '+r.bet_id;$('reference').textContent='Round '+r.bet_id;$('proof').textContent=JSON.stringify(r.proof,null,2);$('verify').disabled=!r.proof;
  }
  function card(c){if(!c)return '<div class="card back" aria-label="Hidden card"></div>';const ranks=['2','3','4','5','6','7','8','9','10','J','Q','K','A'],suits=['♠','♥','♦','♣'];return `<div class="card ${[1,2].includes(c.suit)?'red':''}" aria-label="${ranks[c.rank]} ${suits[c.suit]}"><span>${ranks[c.rank]}</span><span>${suits[c.suit]}</span></div>`;}
  function blackjack(r,pc=r.player_cards||[],dc=r.dealer_cards||[],complete=!!r.proof){$('scene').innerHTML=`<div class="hand"><p>Dealer ${complete&&dc.length===(r.dealer_cards||[]).length?'· '+esc(r.dealer_total):''}</p><div class="cardrow">${dc.map(card).join('')}${!complete?card(null):''}</div></div><div class="hand"><p>Your hand ${pc.length===(r.player_cards||[]).length?'· '+esc(r.player_total||''):''}</p><div class="cardrow">${pc.map(card).join('')||card(null)+card(null)}</div></div>`;}
  async function deal(r,before){let pc=[...(before.player_cards||[])],dc=[...(before.dealer_cards||[])];blackjack(r,pc,dc,false);for(const c of (r.player_cards||[]).slice(pc.length)){await animate(600);pc.push(c);blackjack(r,pc,dc,false);}for(const c of (r.dealer_cards||[]).slice(dc.length)){await animate(600);dc.push(c);blackjack(r,pc,dc,!!r.proof);}await animate(300);}
  function cardsHilo(r,show=true){$('scene').innerHTML=`<div class="hand"><p>${r.choice?esc(r.choice)+' chosen':'Read the card. Choose your direction.'}</p><div class="cardrow">${card(r.up_card||info.preview_card)}${card(show?r.draw_card:null)}</div></div><div class="hero-sub">${show&&r.proof?(r.is_win?'Prediction reached':'Prediction missed · ties lose'):'The next card is committed on the server'}</div>`;}
  function preview(){if(m!=='hilo')return;$('preview').innerHTML='<p>Next up-card · no wager yet</p><div class="cardrow">'+card(info.preview_card)+'</div>';const rank=info.preview_card?.rank;for(const o of $('choice').options)o.disabled=(o.value==='higher'&&rank===12)||(o.value==='lower'&&rank===0);if($('choice').selectedOptions[0].disabled)$('choice').value=rank===12?'lower':'higher';paytable();}
  function mines(r){const revealed=r.revealed||[],hazards=r.mine_positions||[];$('scene').innerHTML='<div class="grid mines">'+Array.from({length:25},(_,i)=>`<button class="tile ${revealed.includes(i)?'safe chosen':''} ${hazards.includes(i)?'mine':''}" data-tile="${i}" aria-label="Chamber ${i+1}${revealed.includes(i)?', safe':hazards.includes(i)?', mine':''}" ${phase!=='active'||busy||revealed.includes(i)?'disabled':''}>${hazards.includes(i)?'✦':revealed.includes(i)?'◆':'·'}</button>`).join('')+'</div><div class="hero-sub">'+(r.proof?'The complete chamber map':`${revealed.length} crystals found · ${money(r.current_win)} available`)+'</div>';document.querySelectorAll('[data-tile]').forEach(b=>b.onclick=()=>move('reveal',{tile:Number(b.dataset.tile)}));}
  function tower(r){$('scene').innerHTML='<div class="tower">'+Array.from({length:7},(_,floor)=>`<div class="floor ${floor===(r.level||0)&&!r.proof?'current':''}"><small>0${floor+1}</small>${[0,1,2].map(c=>`<button class="door ${(r.route||[])[floor]===c?'selected':''} ${(r.hazards||[])[floor]===c?'trap':''}" data-floor="${floor}" data-door="${c}" ${phase!=='active'||busy||floor!==(r.level||0)?'disabled':''} aria-label="Floor ${floor+1}, door ${c+1}">${(r.route||[])[floor]===c?'◆':''}</button>`).join('')}<small>${r.ladder?.[floor]||info.tower_ladder?.[floor]||'—'}×</small></div>`).join('')+'</div><div class="hero-sub">'+(r.proof?'Your route is preserved':`Floor ${Math.min(7,(r.level||0)+1)} · choose a door or collect`)+'</div>';document.querySelectorAll('[data-door]').forEach(b=>b.onclick=()=>move('choose',{choice:Number(b.dataset.door),level:Number(b.dataset.floor)}));}
  function keno(r,drawCount=10){
    const editable=['ready','result'].includes(phase)&&!busy;
    const revealing=phase==='revealing';
    const drawn=revealing?(r.draw_order||r.drawn||[]).slice(0,drawCount):[];
    const shownPicks=revealing?new Set(r.picks||[]):picks;
    const previous=!revealing&&last;
    $('scene').innerHTML='<div class="keno-ticket-heading"><b>'+ (editable?'Choose your next five numbers':revealing?'Drawing your ticket':'Confirming your ticket') +'</b><span>'+picks.size+'/5 selected</span><button id="clear-ticket" '+(!editable?'disabled':'')+'>Clear picks</button></div><div class="grid keno">'+Array.from({length:40},(_,i)=>{
      const n=i+1;return `<button data-number="${n}" class="${shownPicks.has(n)?'picked':''} ${drawn.includes(n)?'drawn':''} ${shownPicks.has(n)&&drawn.includes(n)?'hit':''}" aria-pressed="${shownPicks.has(n)}" ${!editable?'disabled':''}>${n}</button>`;
    }).join('')+'</div><div class="draw-line">'+drawn.map(n=>'<span class="orb">'+n+'</span>').join('')+'</div>'+
      (previous?'<div class="keno-last-result"><b>Last result · '+esc(previous.hits)+' hits</b><p>Ticket: '+(previous.picks||[]).map(esc).join(' · ')+'</p><div class="draw-line">'+(previous.draw_order||previous.drawn||[]).map(n=>'<span class="orb '+((previous.picks||[]).includes(n)?'last-hit':'')+'">'+n+'</span>').join('')+'</div></div>':'');
    document.querySelectorAll('[data-number]').forEach(b=>b.onclick=()=>{
      if(!['ready','result'].includes(phase)||busy)return;
      const n=Number(b.dataset.number);
      if(picks.has(n))picks.delete(n);else if(picks.size<5)picks.add(n);
      else {$('message').textContent='Five selected. Unselect a number or Clear picks to choose another.';return;}
      $('message').textContent='';state(phase);keno(last||{});paytable();
    });
    $('clear-ticket').onclick=()=>{if(!editable)return;picks.clear();$('message').textContent='';state(phase);keno(last||{});paytable();};
  }
  function wheel(r={},finished=true){const count=r.segments_count||number('segments')||10;const table=r.segments_table||info.configurations?.[count]?.[value('risk')]||Array(count).fill('—');const colors=['#49316b','#8b4a67','#a06b32','#322946'];const gradient=table.map((_,i)=>`${colors[i%colors.length]} ${i*360/count}deg ${(i+1)*360/count}deg`).join(',');$('scene').innerHTML=`<div class="wheel-wrap"><div class="pointer"></div><div id="wheel-disc" class="wheel-disc" style="background:conic-gradient(${gradient});transform:rotate(${wheelAngle}deg)">${table.map((n,i)=>`<span style="transform:translate(-50%,-50%) rotate(${(i+.5)*360/count}deg) translateY(calc(-1 * var(--wheel-radius, 108px))) rotate(90deg)">${n}×</span>`).join('')}</div><div class="wheel-hub">☀</div></div>${finished&&r.proof?'<div class="hero-sub">Segment '+(r.winning_index+1)+' · '+r.multiplier+'×</div>':''}`;}
  function plinko(r={},t=1){if(!$('plinko-canvas'))$('scene').innerHTML='<canvas id="plinko-canvas" width="740" height="430" aria-label="Plinko board"></canvas>';const canvas=$('plinko-canvas'),ctx=canvas.getContext('2d'),rows=r.rows||number('rows')||16;ctx.clearRect(0,0,740,430);const dx=580/rows,dy=320/rows,top=30;ctx.fillStyle='#ecdbff';for(let row=0;row<rows;row++)for(let c=0;c<=row;c++){ctx.beginPath();ctx.arc(370+(c-row/2)*dx,top+row*dy,3,0,Math.PI*2);ctx.fill();}const table=info.multipliers?.[rows]?.[r.risk||value('risk')]||[];ctx.font='10px sans-serif';ctx.textAlign='center';for(let i=0;i<=rows;i++){const x=370+(i-rows/2)*dx;ctx.fillStyle=r.proof&&t===1&&i===r.slot_index?config.accent:'#251c40ee';ctx.fillRect(x-dx*.47,365,dx*.94,30);ctx.fillStyle=r.proof&&t===1&&i===r.slot_index?'#171022':'#eee';ctx.fillText((table[i]??'—')+'×',x,384);}if(!r.directions)return;let points=[{x:370,y:top-14}],x=370;for(let i=0;i<rows;i++){x+=(r.directions[i]?1:-1)*dx/2;points.push({x,y:top+(i+1)*dy});}points.push({x,y:365});const segment=Math.min(points.length-2,Math.floor(t*(points.length-1))),local=Math.min(1,t*(points.length-1)-segment),a=points[segment],b=points[segment+1];ctx.shadowColor=config.secondary;ctx.shadowBlur=20;ctx.fillStyle='#fff3f9';ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*local,a.y+(b.y-a.y)*local-(reduced?0:Math.sin(local*Math.PI)*7),8,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  function limbo(r={},t=1) {
    if(!$('limbo-flight'))$('scene').innerHTML=`<div id="limbo-flight" class="limbo-flight"><div class="limbo-stars"></div><div class="limbo-target">TARGET <b id="limbo-target"></b></div><div class="limbo-trail"></div><div id="limbo-rocket" class="limbo-rocket" aria-hidden="true"><svg viewBox="0 0 80 120"><path fill="#ff9348" d="M29 83 Q20 111 40 120 Q60 111 51 83Z"/><path fill="#fff5b1" d="M34 83 Q30 103 40 112 Q50 103 46 83Z"/><path fill="#6288db" d="M26 49 9 85 29 77 M54 49 71 85 51 77"/><path fill="#e8efff" d="M40 3 Q13 32 27 85 H53 Q67 32 40 3Z"/><circle cx="40" cy="39" r="11" fill="#172b59" stroke="#8abfff" stroke-width="4"/><path stroke="#879abf" stroke-width="3" d="M29 73H51"/></svg></div><div id="limbo-burst" class="limbo-burst" aria-hidden="true">${Array.from({length:18},(_,i)=>`<i style="--angle:${i*20}deg;--distance:${45+i%4*22}px"></i>`).join('')}</div><div class="limbo-caption"><strong id="limbo-status"></strong><span id="limbo-detail"></span></div></div>`;
    const done=!!r.proof,ending=done&&t>=.72,win=!!r.is_win;
    const climb=Math.min(1,t/.72),finish=reduced?(ending?1:0):Math.max(0,(t-.72)/.28);
    const altitude=done?(win?205:142):0;
    const flight=$('limbo-flight');
    flight.className='limbo-flight '+(ending?(win?'arrived':'crashed'):done?'climbing':'ready');
    flight.style.setProperty('--altitude',`${reduced?altitude:altitude*climb}px`);
    flight.style.setProperty('--finish',finish);
    $('limbo-rocket').style.transform=`translate(-50%, ${-(reduced?altitude:altitude*climb)+(ending&&!win&&!reduced?finish*65:0)}px) rotate(${ending&&!win&&!reduced?finish*95:0}deg)`;
    $('limbo-rocket').style.opacity=ending&&!win?Math.max(0,1-finish*2):1;
    $('limbo-burst').style.bottom=`${75+altitude}px`;
    $('limbo-target').textContent=(r.target||number('target')||2)+'×';
    $('limbo-status').textContent=ending?(win?'TARGET REACHED':'CRASHED'):done?'IGNITION · CLIMBING':'READY FOR LAUNCH';
    $('limbo-detail').textContent=ending?(win?'Successful flight · result retained':'Flight lost before target · result retained'):'Fixed target · no live cashout';
  }
  function render(r={}) {
    if(m==='limbo')return limbo(r);
    if(m==='plinko'){plinko(r);let label=$('plinko-label');if(!label){label=document.createElement('div');label.id='plinko-label';label.className='hero-sub';$('scene').append(label);}label.textContent=r.proof?`Bin ${r.slot_index+1} · ${r.multiplier}× return`:'One committed path through the pegs';return;}
    if(m==='mines')return mines(r);
    if(m==='tower')return tower(r);
    if(m==='keno')return keno(r);
    if(m==='wheel')return wheel(r);
    if(m==='blackjack')return blackjack(r);
    if(m==='hilo')return cardsHilo(r);
    let text='Ready',sub='',icon='';
    if(m==='dice'){text=r.pending?'···':r.roll??'00.00';sub=r.proof?`Roll ${r.roll} · ${r.condition} ${r.target}`:`${value('condition')||'under'} ${number('target')||50} · 0.00–99.99`;}
    if(m==='crash'){text=r.multiplier?Number(r.multiplier).toFixed(2)+'×':'1.00×';sub=r.proof?(r.status==='crashed'?'Flight ended':`Cashed out · flight crash ${Number(r.crash_multiplier).toFixed(2)}×`):'Cashout is settled at the server, not this display';icon='↗';}
    $('scene').innerHTML=`${icon?`<div class="flight ${(phase==='active'||r.pending)?'moving':''}">${icon}</div>`:''}<div class="hero-value">${esc(text)}</div><div class="hero-sub">${esc(sub)}</div>`;
  }
  function ticket(){
    if(!['ready','result'].includes(phase))return;
    $('play').disabled=busy||picks.size!==5;
    $('play').textContent=picks.size===5?`Draw selected numbers · ${money(number('wager'))}`:`Choose ${5-picks.size} more number${5-picks.size===1?'':'s'}`;
  }
  function paytable(){let entries=[];
    if(m==='plinko')entries=(info.multipliers?.[number('rows')]?.[value('risk')]||[]).map((v,i)=>`Bin ${i+1}: ${v}×`);
    if(m==='wheel')entries=(info.configurations?.[number('segments')]?.[value('risk')]||[]).map((v,i)=>`${i+1}: ${v}×`);
    if(m==='keno'){entries=Object.entries(info.keno_table||{}).map(([hits,mult])=>`${hits} hits: ${mult}×`);$('ticket').textContent=`Next ticket: ${picks.size}/5 numbers selected`;ticket();}
    if(m==='hilo'&&info.preview_card){const ranks=value('choice')==='higher'?12-info.preview_card.rank:info.preview_card.rank;entries=[`${ranks}/13 winning ranks`,`${ranks?(Math.floor(.95/(ranks/13)*10000)/10000):0}× return`];}
    if(m==='dice'){$('target').min=value('condition')==='over'?1.99:1;$('target').max=value('condition')==='over'?98.99:98;const target=Math.round(number('target')*100),wins=value('condition')==='under'?target:9999-target;entries=[`${wins}/10000 winning rolls`,`${wins?Math.floor(.95/(wins/10000)*10000)/10000:0}× return`];}
    $('paytable').innerHTML=entries.map(e=>'<span>'+esc(e)+'</span>').join('');
  }
  $('play').onclick=start;$('recover').onclick=initialize;
  $('verify').onclick=async()=>{try{const proof=last?.proof;const result=await PromexHtmlGame.verify(proof);$('message').textContent='Fairness check: '+JSON.stringify(result);}catch(e){$('message').textContent='Verification failed: '+e.message;}};
  document.querySelectorAll('.panel input,.panel select').forEach(el=>el.addEventListener('change',()=>{if(!['ready','result'].includes(phase))return;state(phase);paytable();if(phase==='ready')render({});}));
  initialize();
})();

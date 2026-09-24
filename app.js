(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const names = ['钻石','金币','金币碎片','福气卷轴','好运星','锦鲤碎片','幸运粒子','心愿值'];
  const products = [
    {name:'香辣鸡翅',flavor:'香辣派'},
    {name:'吮指原味鸡',flavor:'经典派'},
    {name:'葡式蛋挞',flavor:'甜蜜派'},
    {name:'香辣鸡腿堡',flavor:'热辣派'},
    {name:'老北京鸡肉卷',flavor:'卷饼派'},
    {name:'黄金鸡块',flavor:'快乐派'}
  ];
  const tickerLines = [
    '今天的好运正在加速，距离快乐桶又近了一点',
    '再抽一次，下一份奖励正在赶来',
    '最后一点点了，先别走！',
    '分享给朋友看看，你离目标真的很近了',
    '金币与钻石已就位，冲刺继续'
  ];
  const state = {
    product: products[0], cash: 0, spinsLeft: 3, cashSpin: 0,
    tier: -1, tierTry: 0, counts: [], wheelAngle: 0,
    busy: false, sound: false, scanToken: 0
  };
  let activeModal = null, lastFocus = null, toastTimer, tickerIndex = 0, audioContext;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const unit = index => names[index] || ('第' + (index + 1) + '级幸运值');
  const fmt = amount => amount.toFixed(2);
  const cashWinnings = [39, 8, 2, .9];

  function showScreen(id) {
    for (const name of ['entry','scan','game','ending']) $(name).hidden = name !== id;
    window.scrollTo({top:0,behavior:'auto'});
  }

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2300);
  }

  function sound(freq = 640, duration = .1, gain = .055) {
    if (!state.sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      audioContext ||= new Audio();
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(freq * 1.3, audioContext.currentTime + duration);
      volume.gain.setValueAtTime(gain, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
      oscillator.connect(volume).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {}
  }

  function celebrate(strength = 24) {
    if (reducedMotion()) return;
    const host = $('effects');
    const symbols = ['✦','✧','★','🪙','✦','💎'];
    for (let i = 0; i < strength; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = symbols[i % symbols.length];
      p.style.left = (45 + Math.random() * 10) + '%';
      p.style.top = (27 + Math.random() * 18) + '%';
      p.style.setProperty('--dx', ((Math.random() - .5) * 370) + 'px');
      p.style.setProperty('--dy', ((Math.random() - .2) * 460) + 'px');
      p.style.setProperty('--rot', ((Math.random() - .5) * 600) + 'deg');
      host.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }
  }

  function floatPlus(text) {
    const el = document.createElement('div');
    el.className = 'float-plus';
    el.textContent = text;
    $('effects').appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  function setEncouragement(message) {
    $('encouragement').textContent = message;
    $('microWin').textContent = message;
    $('encouragement').animate?.(
      [{transform:'scale(.88)',opacity:.4},{transform:'scale(1.08)',opacity:1},{transform:'scale(1)',opacity:1}],
      {duration:650,easing:'cubic-bezier(.15,1.4,.45,1)'}
    );
  }

  function startScan() {
    if (state.busy) return;
    state.busy = true;
    state.product = products[Math.floor(Math.random() * products.length)];
    const token = ++state.scanToken;
    showScreen('scan');
    $('scanReveal').hidden = true;
    $('receipt').classList.remove('ready');
    $('receiptFlavor').textContent = '识别中 ···';
    $('receiptProduct').textContent = '识别中 ···';
    $('receiptStatus').textContent = '正在解锁';
    $('scanFill').style.width = '0%';
    $('scanPercent').textContent = '0%';
    const duration = reducedMotion() ? 800 : 2700;
    const start = performance.now();
    function frame(now) {
      if (token !== state.scanToken) return;
      const ratio = Math.min(1, (now - start) / duration);
      const smooth = 1 - Math.pow(1 - ratio, 2.6);
      const percent = Math.round(smooth * 100);
      $('scanFill').style.width = percent + '%';
      $('scanPercent').textContent = percent + '%';
      if (percent >= 34) {
        $('receiptFlavor').textContent = state.product.flavor;
        $('scanMessage').textContent = '已找到你的口味偏好…';
      }
      if (percent >= 69) {
        $('receiptProduct').textContent = state.product.name;
        $('scanMessage').textContent = '正在发放抽奖次数…';
      }
      if (ratio < 1) requestAnimationFrame(frame);
      else {
        state.busy = false;
        $('receiptStatus').textContent = '3 次抽奖已到账';
        $('receipt').classList.add('ready');
        $('detectedProduct').textContent = state.product.name;
        $('productDetail').textContent = '最近吃过' + state.product.name + '的你，手气一定不差';
        $('scanMessage').textContent = '福利匹配成功！';
        $('scanReveal').hidden = false;
        celebrate(28);
        sound(800, .14);
      }
    }
    requestAnimationFrame(frame);
  }

  function enterGame() {
    showScreen('game');
    updateGame();
    celebrate(15);
  }

  function setWheelLabels(labels) {
    const host = $('wheelLabels');
    host.replaceChildren();
    labels.forEach((label, index) => {
      const el = document.createElement('span');
      el.className = 'wheel-label' + (index % 2 ? ' light' : '');
      el.style.setProperty('--angle', (index * 60) + 'deg');
      el.style.setProperty('--reverse', (-index * 60) + 'deg');
      el.textContent = label;
      host.appendChild(el);
    });
  }

  function updateGame() {
    const cash = state.cash;
    $('cashValue').textContent = fmt(cash);
    $('missingText').textContent = '还差 ¥' + fmt(Math.max(.01, 50 - cash));
    const progress = Math.min(99.98, (cash / 50) * 100);
    $('cashFill').style.width = progress + '%';
    $('cashSpark').style.left = progress + '%';
    $('cashTrack').setAttribute('aria-valuenow', String(cash));
    $('currencyCard').hidden = state.tier < 0;
    const cashPhase = state.tier < 0;

    if (cashPhase) {
      $('phaseTitle').textContent = '幸运大转盘';
      $('phaseSub').textContent = '转一转，看看今天能拿到多少福利金';
      $('chances').textContent = state.spinsLeft > 0 ? '剩余 ' + state.spinsLeft + ' 次' : '追加机会';
      $('actionBtn').textContent = state.spinsLeft > 0 ? '免费抽奖 · 还剩 ' + state.spinsLeft + ' 次' : '邀请好友 · 再得 1 次';
      setWheelLabels(['¥39','¥8','¥2','¥0.9','钻石','再来一次']);
      if (cash >= 49) setEncouragement(cash >= 49.9 ? '只差 ¥0.10！马上就能免费拿' : '已经 ¥49 了！再抽一次就快了');
    } else {
      const current = unit(state.tier);
      const count = state.counts[state.tier] || 0;
      $('phaseTitle').textContent = current + '幸运转盘';
      $('phaseSub').textContent = '集满 10 ' + current + '，兑换最后一步';
      $('chances').textContent = '仅差 ' + (10 - count) + ' ' + current;
      $('actionBtn').textContent = state.tierTry < 2 ? '继续抽奖 · 获取' + current : '冲刺最后 1 ' + current;
      $('currencyCount').textContent = count + ' / 10 ' + current;
      $('currencyFill').style.width = (count * 10) + '%';
      $('currencyRule').textContent = state.tier === 0 ? '集满 10 钻石，可兑换最后 ¥0.01' : '集满 10 ' + current + '，可兑换 1 ' + unit(state.tier - 1);
      $('chain').replaceChildren();
      for (let i = 0; i <= state.tier; i++) {
        const chip = document.createElement('span');
        chip.textContent = (state.counts[i] || 0) + '/10 ' + unit(i);
        if (i === state.tier) chip.className = 'current';
        $('chain').appendChild(chip);
      }
      setWheelLabels(['8'+current,'1'+current,'加速卡','惊喜礼','更多'+current,'再来一次']);
      setEncouragement(count === 9 ? '9/10 了！就差最后 1 ' + current : '下一抽也许就满了！');
    }
    $('actionBtn').disabled = state.busy;
    $('wheelCenter').disabled = state.busy;
  }

  function animateCash(from, to) {
    const el = $('cashValue');
    const card = el.parentElement;
    const start = performance.now();
    const duration = reducedMotion() ? 120 : 900;
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(frame);
      else {
        el.textContent = fmt(to);
        card.classList.remove('pop','shimmer');
        void card.offsetWidth;
        card.classList.add('pop','shimmer');
      }
    }
    requestAnimationFrame(frame);
  }

  async function rotateWheel(targetIndex, callback) {
    if (state.busy) return;
    state.busy = true;
    $('actionBtn').disabled = true;
    $('wheelCenter').disabled = true;
    $('wheelWrap').classList.add('spinning');
    const wheel = $('wheel');
    const previous = ((state.wheelAngle % 360) + 360) % 360;
    const target = (360 - targetIndex * 60) % 360;
    const adjust = (target - previous + 360) % 360;
    state.wheelAngle += 360 * 5 + adjust;
    const duration = reducedMotion() ? 250 : 3400;
    wheel.style.transition = 'transform ' + duration + 'ms cubic-bezier(.16,.67,.12,1)';
    wheel.style.transform = 'rotate(' + state.wheelAngle + 'deg)';
    sound(460, .08);
    await wait(duration + 90);
    $('wheelWrap').classList.remove('spinning');
    state.busy = false;
    $('actionBtn').disabled = false;
    $('wheelCenter').disabled = false;
    sound(900, .17);
    callback();
  }

  function openModal(options) {
    activeModal = options;
    lastFocus = document.activeElement;
    const share = options.kind === 'share';
    $('overlay').className = 'overlay open' + (share ? ' sheet' : '');
    $('overlay').setAttribute('aria-hidden','false');
    const meter = options.meter == null ? '' : '<div class="modal-meter"><span style="width:' + Math.min(options.meter,99.98) + '%"></span></div>';
    // 分享弹窗里带一个昵称输入框，好友落地页会显示「XX 邀请你帮他助力」
    let savedName = '';
    try { savedName = localStorage.getItem('kfc_share_name') || ''; } catch {}
    const preview = share
      ? '<div class="share-preview">' +
        '<label class="share-name-row" for="shareName">' +
        '<span>你的昵称</span>' +
        '<input id="shareName" type="text" maxlength="12" autocomplete="off" ' +
        'placeholder="填了好友才知道是谁" value="' + savedName.replace(/"/g, '&quot;') + '">' +
        '</label>' +
        '<b>朋友，帮我看看这份疯四好运！</b><br>我离 ¥50 快乐桶只差一点点，点开看看你能抽到多少。' +
        '<input id="manualLink" type="text" readonly hidden aria-label="分享链接">' +
        '</div>'
      : '';
    $('modalBody').innerHTML =
      '<div class="modal-top">' + (options.kicker || '幸运加成') + '</div>' +
      '<h2 id="modalTitle">' + options.title + '</h2>' +
      '<div class="modal-art"><span aria-hidden="true">' + (options.icon || '🎉') + '</span></div>' +
      (options.value ? '<div class="modal-value">' + options.value + '</div>' : '') +
      '<p>' + options.description + '</p>' + meter +
      (options.hint ? '<p class="modal-hint">' + options.hint + '</p>' : '') + preview +
      '<button class="primary" id="modalPrimary" type="button">' + (options.primary || '继续领取') + '</button>' +
      (options.secondary ? '<button class="modal-secondary" id="modalSecondary" type="button">' + options.secondary + '</button>' : '');
    $('modalPrimary').onclick = options.onPrimary || closeModal;
    if (options.secondary) $('modalSecondary').onclick = options.onSecondary || closeModal;
    $('closeModal').focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('overlay').className = 'overlay';
    $('overlay').setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    activeModal = null;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  function rewardModal(value, title, description, primary, onPrimary, hint) {
    celebrate(26);
    floatPlus(value);
    openModal({kicker:'恭喜获得奖励',title,icon:'💰',value,description,primary,onPrimary,hint,meter:(state.cash/50)*100});
  }

  function spinCash() {
    if (state.spinsLeft <= 0) return openShareGate('cash');
    const index = state.cashSpin;
    if (index >= cashWinnings.length) return;
    state.spinsLeft--;
    rotateWheel(index, () => {
      const from = state.cash;
      const won = cashWinnings[index];
      state.cashSpin++;
      state.cash = Number((from + won).toFixed(2));
      updateGame();
      animateCash(from, state.cash);
      const title = state.cashSpin === 1 ? '一抽就拿到 ¥39！' :
                    state.cashSpin === 2 ? '马上到 ¥50 了！' :
                    state.cashSpin === 3 ? '已经累计 ¥49！' : '就差 ¥0.10！';
      const description = state.cashSpin === 3 ? '你的运气真的很强。再获得一次抽奖机会，快乐桶就在眼前！' :
                          state.cashSpin === 4 ? '金额来到 ¥49.90，专属冲刺加成即将到账。' :
                          '福利金已经到账，离 0 元拿快乐桶又近了一大步。';
      const primary = state.cashSpin === 3 ? '邀请好友 · 领取抽奖机会' :
                      state.cashSpin === 4 ? '进入钻石冲刺' : '继续抽奖';
      const next = state.cashSpin === 3 ? () => {closeModal();openShareGate('cash')} :
                   state.cashSpin === 4 ? unlockDiamond : closeModal;
      setEncouragement(state.cashSpin >= 3 ? '真的只差一点了！继续加油' : '这一抽太幸运了，继续！');
      setTimeout(() => rewardModal('+¥' + fmt(won),title,description,primary,next,
        state.cashSpin === 3 ? '预计再抽 1 次，就能接近 ¥50' : '下一次可能更幸运'),reducedMotion()?150:600);
    });
  }

  function unlockDiamond() {
    closeModal();
    const from = state.cash;
    state.cash = 49.99;
    state.tier = 0;
    state.tierTry = 0;
    state.counts = [0];
    updateGame();
    animateCash(from, state.cash);
    celebrate(30);
    floatPlus('+¥0.09');
    openModal({
      kicker:'冲刺加成已到账',
      title:'再送你 ¥0.09！',
      icon:'💎',value:'¥49.99 / ¥50',
      description:'福利金已到 ¥49.99。集满 10 颗钻石，就能兑换最后 ¥0.01！',
      hint:'最后一分钱，冲刺一下就到手',
      primary:'开始攒钻石',
      onPrimary:closeModal,
      meter:99.98
    });
  }

  function spinTier() {
    if (state.tierTry >= 2) return openShareGate('tier');
    const current = unit(state.tier);
    const won = state.tierTry === 0 ? 8 : 1;
    const targetIndex = state.tierTry === 0 ? 0 : 1;
    rotateWheel(targetIndex, () => {
      state.tierTry++;
      state.counts[state.tier] = (state.counts[state.tier] || 0) + won;
      updateGame();
      celebrate(state.tierTry === 2 ? 30 : 18);
      floatPlus('+' + won + current);
      const last = state.tierTry === 2;
      setTimeout(() => openModal({
        kicker:last?'最后冲刺':'好运继续',
        title:last?'已经 9/10 了！':'一口气获得 ' + won + ' ' + current,
        icon:state.tier===0?'💎':'🪙',
        value:'+' + won + current,
        description:last?'就差最后 1 ' + current + '，邀请好友再抽一把，马上兑换。':'当前已集到 8/10 ' + current + '，下一抽非常关键！',
        hint:last?'只差一点了，你已经非常接近目标':'再抽一次，冲向最后一格',
        primary:last?'冲刺最后 1 ' + current:'继续抽奖',
        onPrimary:last?() => {closeModal();openShareGate('tier')}:closeModal,
        meter:90
      }),reducedMotion()?80:350);
    });
  }

  function unlockNextTier() {
    const old = unit(state.tier);
    rotateWheel(3, () => {
      state.tier++;
      state.tierTry = 0;
      state.counts[state.tier] = 0;
      updateGame();
      celebrate(30);
      sound(920,.2);
      setTimeout(() => openModal({
        kicker:'恭喜解锁新任务',
        title:'再集 10 ' + unit(state.tier),
        icon:'🎁',
        value:'9 / 10 ' + old,
        description:'福利加码！集满 10 ' + unit(state.tier) + '，即可兑换最后 1 ' + old + '。只差一步了！',
        hint:'距离 ¥50 又近了一点',
        primary:'继续冲刺',
        onPrimary:closeModal,
        secondary:state.tier>=3?'我不抽了，看看结果':null,
        onSecondary:state.tier>=3?showEnding:null,
        meter:(state.cash/50)*100
      }),reducedMotion()?100:450);
    });
  }

  // 把用户填的昵称记在本地，下次分享不用重填
  function getShareName() {
    let name = '';
    try { name = localStorage.getItem('kfc_share_name') || ''; } catch {}
    return name.trim().slice(0, 12);
  }
  function setShareName(name) {
    try { localStorage.setItem('kfc_share_name', String(name || '').trim().slice(0, 12)); } catch {}
  }

  async function sharePage(grant = true) {
    const base = location.href.split('#')[0].split('?')[0];
    // 昵称：优先取用户在分享弹窗里填的，没填就退回「好友」
    const input = $('shareName');
    const name = ((input && input.value) || getShareName() || '').trim().slice(0, 12);
    if (name) setShareName(name);
    // 带上助力参数：好友点进来会先看到「帮 TA 助力」落地页。
    // 若自己还没抽过（cash=0），用一个接近目标的演出值，否则好友看到「还差 ¥50」很出戏。
    const shareCash = state.cash > 0 ? state.cash : Number((45.5 + Math.random() * 3.4).toFixed(2));
    const url = base + '?from=' + encodeURIComponent(name || '好友') + '&av=' + encodeURIComponent(fmt(shareCash));
    // 同步到地址栏，保证微信右上角原生分享也用这个带参链接（boost.js 提供）
    if (typeof window.__kfcSyncShareUrl === 'function') window.__kfcSyncShareUrl();
    const title = '疯狂星期四，帮我看看这份好运';
    if (navigator.share) {
      try {
        await navigator.share({title,text:'我距离 ¥50 快乐桶只差一点点，来看看你能抽到多少',url});
        toast(grant ? '分享已打开，额外机会已到账' : '分享面板已打开');
        return true;
      } catch (error) {
        if (error && error.name === 'AbortError') return false;
      }
    }
    const message = title + '：' + url;
    try {
      await navigator.clipboard.writeText(message);
      toast(grant ? '链接已复制，额外机会已到账' : '链接已复制，发给好友试试');
      return true;
    } catch {
      const input = $('manualLink');
      if (input) {
        input.hidden = false;
        input.value = url;
        input.focus();
        input.select();
      }
      toast('长按链接复制后，返回继续');
      return false;
    }
  }

  function openSharePreview() {
    openModal({
      kind:'share',kicker:'邀请好友一起玩',title:'看看朋友能抽到多少',
      icon:'🤝',description:'分享你的疯狂星期四挑战，邀请好友也来试试手气。',
      primary:'分享挑战链接',
      onPrimary:async () => {if (await sharePage(false)) closeModal()},
      secondary:'继续抽奖',onSecondary:closeModal
    });
  }

  function openShareGate(kind) {
    if (state.busy) return;
    openModal({
      kind:'share',
      kicker:'最后一点 · 好友加速',
      title:kind==='cash'?'只差 ¥1，就快成功！':'只差最后 1 ' + unit(state.tier) + '！',
      icon:'🤝',
      value:kind==='cash'?'¥49.00 / ¥50':'9 / 10 ' + unit(state.tier),
      description:kind==='cash'?'再获得一次抽奖机会，就能把福利金推到 ¥49.90。':'再转一次，把最后一步补上，奖励就在前面。',
      hint:'邀请好友，立刻点亮额外机会',
      primary:'分享给好友 · 领取机会',
      onPrimary:async () => {
        const success = await sharePage();
        if (!success) return;
        closeModal();
        if (kind === 'cash') {
          state.spinsLeft += 1;
          updateGame();
          celebrate(22);
          openModal({
            kicker:'加速机会已到账',title:'额外抽奖 +1 次',icon:'🎟️',value:'+1 次',
            description:'继续转动幸运转盘，看看距离 ¥50 还差多少。',
            primary:'马上抽奖',onPrimary:closeModal,meter:(state.cash/50)*100
          });
        } else {
          toast('最后一抽已开启');
          unlockNextTier();
        }
      },
      secondary:state.tier>=3?'不抽了，看看结果':'暂时收起',
      onSecondary:state.tier>=3?showEnding:closeModal
    });
  }

  function handleAction() {
    if (state.busy) return;
    if (state.tier < 0) spinCash();
    else spinTier();
  }

  function showEnding() {
    closeModal();
    showScreen('ending');
    celebrate(30);
  }

  function resetGame() {
    state.scanToken++;
    state.busy = false;
    state.cash = 0;
    state.spinsLeft = 3;
    state.cashSpin = 0;
    state.tier = -1;
    state.tierTry = 0;
    state.counts = [];
    state.wheelAngle = 0;
    $('wheel').style.transition = 'none';
    $('wheel').style.transform = 'rotate(0deg)';
    closeModal();
    showScreen('entry');
    updateGame();
  }

  $('scanBtn').addEventListener('click',startScan);
  $('enterGameBtn').addEventListener('click',enterGame);
  $('actionBtn').addEventListener('click',handleAction);
  $('wheelCenter').addEventListener('click',handleAction);
  $('shareBtn').addEventListener('click',() => {
    if (state.tier < 0 && state.cashSpin === 3) openShareGate('cash');
    else if (state.tier >= 0 && state.tierTry >= 2) openShareGate('tier');
    else openSharePreview();
  });
  $('resetBtn').addEventListener('click',resetGame);
  $('endRestart').addEventListener('click',resetGame);
  $('closeModal').addEventListener('click',closeModal);
  $('overlay').addEventListener('click',event => {if (event.target === $('overlay')) closeModal()});
  document.addEventListener('keydown',event => {
    if (event.key === 'Escape' && $('overlay').classList.contains('open')) closeModal();
    if (event.key === 'Tab' && $('overlay').classList.contains('open')) {
      const focusable = [...$('overlay').querySelectorAll('button:not([disabled]),input:not([hidden])')];
      const first = focusable[0],last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last.focus()}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first.focus()}
    }
  });
  $('soundBtn').addEventListener('click',() => {
    state.sound = !state.sound;
    $('soundBtn').setAttribute('aria-pressed',String(state.sound));
    $('soundBtn').setAttribute('aria-label',state.sound?'关闭音效':'打开音效');
    $('soundBtn').textContent = state.sound?'♫':'♪';
    sound(740,.12);
  });

  setInterval(() => {
    tickerIndex = (tickerIndex + 1) % tickerLines.length;
    $('tickerText').textContent = tickerLines[tickerIndex];
    $('tickerText').parentElement.classList.remove('fade');
    void $('tickerText').offsetWidth;
    $('tickerText').parentElement.classList.add('fade');
  },4400);
  updateGame();
})();

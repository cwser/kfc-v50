/* ==========================================================================
   好友助力落地页 + 分享参数同步
   ==========================================================================
   两条职责：

   A. 让分享链接天然带参数
      微信右上角「···」原生分享、长按复制地址，用的都是**当前地址栏 URL**。
      原先只有点页面内「分享助力」按钮才拼 ?from=，所以用微信原生转发出去的
      永远是裸链，好友看不到助力页。这里在页面加载时就把参数写进地址栏，
      并在福利金变化时持续同步，任何转发方式都带参数。

   B. 访客判定
      分享者本机不能看到自己的助力页。
      用 sessionStorage 标记「本机是分享者」：好友在微信里是新会话，
      标记不存在，因此正常看到助力页；分享者刷新自己的页面则不会误判。

   纯前端，无后端。
   ========================================================================== */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const SHARER_KEY = 'kfc_is_sharer';
  const NAME_KEY = 'kfc_share_name';
  const GOAL = 50;
  const HELP_GAIN = 0.01;
  const SCREENS = ['entry', 'scan', 'game', 'ending'];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const sess = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
  };

  const fmt = (n) => n.toFixed(2);

  // 自己的福利金：优先读游戏区实时数值（app.js 在维护）
  let fallbackCash = null;
  function ownCash() {
    const el = $('cashValue');
    const v = el ? parseFloat(el.textContent) : NaN;
    if (Number.isFinite(v) && v > 0) return Number(v.toFixed(2));
    // 还没抽过奖时给一个接近目标的演出值，
    // 否则好友看到「还差 ¥50」很出戏。缓存住，避免每次同步都变。
    if (fallbackCash == null) fallbackCash = Number((45.5 + Math.random() * 3.4).toFixed(2));
    return fallbackCash;
  }

  function shareParams() {
    const name = (store.get(NAME_KEY) || '').trim().slice(0, 12) || '好友';
    return '?from=' + encodeURIComponent(name) + '&av=' + encodeURIComponent(fmt(ownCash()));
  }

  // 把分享参数写进地址栏；og:url 一并同步
  function syncUrl() {
    const next = location.pathname + shareParams() + location.hash;
    const now = location.pathname + location.search + location.hash;
    if (now !== next) {
      try { history.replaceState(null, '', next); } catch {}
    }
    const og = document.querySelector('meta[property="og:url"]');
    // file:// 下 origin 是 "null"，此时不写 og:url
    if (og && location.origin && location.origin !== 'null') {
      og.setAttribute('content', location.origin + next);
    }
  }

  // ------------------------------------------------------------------
  // 让 iOS 浏览器自动收起底部工具栏
  // iOS Safari 在页面可滚动且发生滚动时，会自动收起底栏/地址栏，可视高度随之变大。
  // 这里在加载后与首次触摸时给一个极小的滚动量触发它（1px 位移肉眼不可见）。
  // 注意：是否生效取决于浏览器与系统版本；微信内联浏览器不保证生效，
  // 且系统浏览器 UI 本身无法由网页隐藏（iPhone 上 Apple 未开放 Fullscreen API）。
  // ------------------------------------------------------------------
  function nudgeToolbarCollapse() {
    if (document.documentElement.scrollHeight > window.innerHeight + 2) {
      window.scrollTo(0, 1);
    }
  }
  nudgeToolbarCollapse();
  window.addEventListener('load', nudgeToolbarCollapse);
  window.addEventListener('touchstart', function onFirstTouch() {
    window.removeEventListener('touchstart', onFirstTouch);
    nudgeToolbarCollapse();
  }, { passive: true });

  const params = new URLSearchParams(location.search);
  const fromParam = (params.get('from') || '').trim();
  const isSharer = sess.get(SHARER_KEY) === '1';

  // 暴露给 app.js：分享时同步一次地址栏
  window.__kfcSyncShareUrl = syncUrl;

  // ------------------------------------------------------------------
  // 场景二：分享者本人（无 from 参数，或本机已被标记为分享者）
  // 不显示助力页，只负责让地址栏带上分享参数。
  // ------------------------------------------------------------------
  if (!fromParam || isSharer) {
    sess.set(SHARER_KEY, '1');
    syncUrl();

    const cashEl = $('cashValue');
    if (cashEl && window.MutationObserver) {
      new MutationObserver(syncUrl).observe(cashEl, {
        childList: true, characterData: true, subtree: true,
      });
    }
    // 昵称改了也要同步到地址栏。
    // 注意：#shareName 是 openModal() 动态创建的，加载时还不存在，
    // 所以必须用事件委托，不能直接对它 addEventListener。
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t && t.id === 'shareName') {
        store.set(NAME_KEY, t.value);
        syncUrl();
      }
    });
    return;
  }

  // ------------------------------------------------------------------
  // 场景一：真正的访客（带 from 参数）→ 显示助力页
  // ------------------------------------------------------------------
  let nickname = fromParam;
  try { nickname = decodeURIComponent(fromParam); } catch {}
  nickname = (nickname || '').slice(0, 12) || '好友';

  const rawAv = parseFloat(params.get('av'));
  const friendStart = Number.isFinite(rawAv) && rawAv >= 0 && rawAv <= GOAL
    ? Number(rawAv.toFixed(2))
    : Number((45 + Math.random() * 4.5).toFixed(2));

  function buildBoost() {
    const section = document.createElement('section');
    section.className = 'screen boost';
    section.id = 'boost';

    const gap = Math.max(0, GOAL - friendStart);
    const progress = Math.min(99.98, (friendStart / GOAL) * 100);

    section.innerHTML = [
      '<div class="boost-from">',
      '  <span>👋</span><span><b></b> 邀请你帮他助力</span>',
      '</div>',
      '<h2>帮 TA 攒到 <em>¥50</em><br>就有机会 0 元拿快乐桶</h2>',
      '<p class="boost-sub">点一下助力，帮好友离免费快乐桶更近一步。</p>',
      '<div class="boost-card">',
      '  <div class="boost-card-top"><span>TA 的福利金进度</span><span>目标 ¥50.00</span></div>',
      '  <div class="boost-amount"><small>¥</small><strong></strong></div>',
      '  <div class="boost-track"><span></span></div>',
      '  <p class="boost-gap"></p>',
      '</div>',
      '<div class="boost-actions">',
      '  <button class="boost-help" id="boostHelpBtn" type="button">帮 TA 助力 · 立即点亮</button>',
      '  <button class="boost-skip" id="boostSkipBtn" type="button">我也去抽一次 ›</button>',
      '</div>',
      '<p class="boost-note">娱乐互动 · 非肯德基或拼多多官方活动<br>助力为互动演示，不涉及真实奖励发放</p>',
    ].join('');

    section.querySelector('.boost-from b').textContent = nickname;
    section.querySelector('.boost-amount strong').textContent = fmt(friendStart);
    section.querySelector('.boost-gap').textContent = gap <= 0
      ? 'TA 已经攒满啦！' : '还差 ¥' + fmt(gap);

    const fill = section.querySelector('.boost-track > span');
    requestAnimationFrame(() => { fill.style.width = progress + '%'; });

    return section;
  }

  const app = $('app');
  if (!app) return;

  const boost = buildBoost();
  app.appendChild(boost);

  SCREENS.forEach((id) => {
    const el = $(id);
    if (el) el.hidden = true;
  });
  window.scrollTo({ top: 0, behavior: 'auto' });

  let current = friendStart;
  let helped = false;

  const prefersReduced = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 复用 style.css 里已有的 .particle / .float-plus 与 burst、plusRise 关键帧，
  // 保证助力页的动效与原玩法观感一致
  function burst(count) {
    if (prefersReduced()) return;
    const host = $('effects');
    if (!host) return;
    const symbols = ['✦', '★', '🪙', '💎', '✧'];
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      p.textContent = symbols[i % symbols.length];
      p.style.left = (44 + Math.random() * 12) + '%';
      p.style.top = (46 + Math.random() * 14) + '%';
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 300) + 'px');
      p.style.setProperty('--dy', ((Math.random() - 0.35) * 380) + 'px');
      p.style.setProperty('--rot', ((Math.random() - 0.5) * 540) + 'deg');
      host.appendChild(p);
      setTimeout(() => p.remove(), 1300);
    }
  }

  function floatPlus(text) {
    if (prefersReduced()) return;
    const host = $('effects');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'float-plus';
    el.textContent = text;
    host.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  // ---------------- 「你也获得机会」弹窗 ----------------
  let rewardOverlay = null;
  let lastFocus = null;

  function buildRewardModal() {
    const wrap = document.createElement('div');
    wrap.className = 'boost-overlay';
    wrap.id = 'boostReward';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'boostRewardTitle');
    wrap.innerHTML = [
      '<div class="boost-modal">',
      '  <div class="boost-modal-art" aria-hidden="true">🎁</div>',
      '  <div class="boost-modal-kicker">助力成功</div>',
      '  <h3 id="boostRewardTitle">你也获得 1 次抽奖机会</h3>',
      '  <p>你帮好友推进了福利金，系统也为你点亮了 1 次机会。来看看自己能抽到多少。</p>',
      '  <button class="boost-modal-primary" id="boostRewardPlay" type="button">马上抽奖 <span aria-hidden="true">›</span></button>',
      '  <button class="boost-modal-secondary" id="boostRewardLater" type="button">稍后再说</button>',
      '</div>',
    ].join('');
    document.body.appendChild(wrap);
    return wrap;
  }

  function showReward() {
    if (!rewardOverlay) rewardOverlay = buildRewardModal();
    lastFocus = document.activeElement;
    // 下一帧再加 open，保证入场动画会播放
    requestAnimationFrame(() => rewardOverlay.classList.add('open'));
    const play = $('boostRewardPlay');
    const later = $('boostRewardLater');
    play.onclick = () => { closeReward(); goPlay(); };
    later.onclick = () => { closeReward(); $('boostSkipBtn').focus(); };
    setTimeout(() => play.focus(), 120);
  }

  function closeReward() {
    if (!rewardOverlay) return;
    rewardOverlay.classList.remove('open');
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  function rewardOpen() {
    return !!rewardOverlay && rewardOverlay.classList.contains('open');
  }

  // ---------------- 助力点击 ----------------
  function markHelped() {
    if (helped) return;
    helped = true;

    const btn = $('boostHelpBtn');
    const amountStrong = boost.querySelector('.boost-amount strong');
    const track = boost.querySelector('.boost-track > span');
    const gapEl = boost.querySelector('.boost-gap');

    // 1) 按钮按压反馈：先弹一下再落到「已完成」态
    btn.classList.add('pressed');
    btn.disabled = true;
    btn.textContent = '✓ 助力成功，感谢你';

    // 2) 数值与进度推进（数值带 pop 动画，进度条走 CSS 过渡）
    current = Math.min(GOAL, Number((current + HELP_GAIN).toFixed(2)));
    amountStrong.textContent = fmt(current);
    amountStrong.classList.remove('pop');
    void amountStrong.offsetWidth;
    amountStrong.classList.add('pop');
    track.style.width = Math.min(99.98, (current / GOAL) * 100) + '%';
    const gap = Math.max(0, GOAL - current);
    gapEl.textContent = gap <= 0 ? 'TA 已经攒满啦！' : '还差 ¥' + fmt(gap);
    gapEl.classList.remove('pop');
    void gapEl.offsetWidth;
    gapEl.classList.add('pop');

    // 3) 粒子 + 飘字，让「这一下」有反馈
    burst(26);
    floatPlus('+' + fmt(HELP_GAIN));

    // 3.5) 把弹窗里承诺的「1 次抽奖机会」真正兑现（原先只是文案）
    if (typeof window.__kfcGrantSpin === 'function') window.__kfcGrantSpin();

    // 4) 就地留一条成功态说明（弹窗关闭后仍可见）
    const done = document.createElement('div');
    done.className = 'boost-done open';
    done.innerHTML = [
      '<b>助力成功！</b>',
      '<span>你帮好友推进了 ¥' + fmt(HELP_GAIN) + '，并为自己获得 1 次抽奖机会。</span>',
    ].join('');
    const actions = boost.querySelector('.boost-actions');
    actions.parentNode.insertBefore(done, actions);

    // 5) 稍后弹出「你也获得机会」，先让上面的动效播完
    setTimeout(showReward, prefersReduced() ? 120 : 620);
  }

  // 访客决定自己也玩：转成「分享者」身份，把自己的分享参数写进地址栏，
  // 之后他转发出去的链接才会带参数。
  function goPlay() {
    sess.set(SHARER_KEY, '1');
    SCREENS.forEach((id) => {
      const el = $(id);
      if (el) el.hidden = id !== 'entry';
    });
    boost.hidden = true;
    syncUrl();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  $('boostHelpBtn').addEventListener('click', markHelped);
  $('boostSkipBtn').addEventListener('click', goPlay);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (rewardOpen()) { closeReward(); return; }   // Esc 先关弹窗
    if (!boost.hidden) goPlay();
  });
})();

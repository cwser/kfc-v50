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

  function markHelped() {
    current = Math.min(GOAL, Number((current + HELP_GAIN).toFixed(2)));

    boost.querySelector('.boost-amount strong').textContent = fmt(current);
    boost.querySelector('.boost-track > span').style.width =
      Math.min(99.98, (current / GOAL) * 100) + '%';
    const gap = Math.max(0, GOAL - current);
    boost.querySelector('.boost-gap').textContent = gap <= 0
      ? 'TA 已经攒满啦！' : '还差 ¥' + fmt(gap);

    const btn = $('boostHelpBtn');
    btn.disabled = true;
    btn.textContent = '✓ 助力成功，感谢你';

    const done = document.createElement('div');
    done.className = 'boost-done';
    done.innerHTML = [
      '<b>助力成功！</b>',
      '<span>你帮好友推进了 ¥' + fmt(HELP_GAIN) + '。要不要也来试试手气，看看自己能抽到多少？</span>',
    ].join('');
    const actions = boost.querySelector('.boost-actions');
    actions.parentNode.insertBefore(done, actions);

    $('boostSkipBtn').focus();
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
    if (e.key === 'Escape' && !boost.hidden) goPlay();
  });
})();

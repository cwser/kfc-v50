/* ==========================================================================
   好友助力落地页
   ==========================================================================
   纯前端：好友带 ?from=昵称&av=金额 进来，先看到「帮 TA 助力」页。
   无后端，助力是演出式交互，不做真实数据上报。
   独立文件，不修改 app.js 原有逻辑。
   ========================================================================== */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  // 没带 from 参数 = 自己正常打开，交给原页面逻辑，什么都不做
  const from = (params.get('from') || '').trim();
  if (!from) return;

  // 解码 + 截断，防超长昵称撑破布局
  let nickname = from;
  try {
    nickname = decodeURIComponent(from);
  } catch {}
  nickname = nickname.slice(0, 12) || '好友';

  // 对方金额：优先读 av，非法值就退到一个合理随机数
  const rawAv = parseFloat(params.get('av'));
  const friendCash = Number.isFinite(rawAv) && rawAv >= 0 && rawAv <= 50
    ? Number(rawAv.toFixed(2))
    : Number((45 + Math.random() * 4.5).toFixed(2));

  const HELP_GAIN = 0.01; // 一次助力推进的金额（演出用）
  const GOAL = 50;

  function fmt(n) {
    return n.toFixed(2);
  }

  // ---- 构建助力页 DOM ----
  function buildBoostScreen() {
    const section = document.createElement('section');
    section.className = 'screen boost';
    section.id = 'boost';

    const gap = Math.max(0, GOAL - friendCash);
    const progress = Math.min(99.98, (friendCash / GOAL) * 100);

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

    // 填动态文本（用 textContent 避免昵称注入 HTML）
    section.querySelector('.boost-from b').textContent = nickname;
    section.querySelector('.boost-amount strong').textContent = fmt(friendCash);
    section.querySelector('.boost-gap').textContent = gap <= 0
      ? 'TA 已经攒满啦！'
      : '还差 ¥' + fmt(gap);
    const fill = section.querySelector('.boost-track > span');
    // 下一帧再设宽度，让过渡动画生效
    requestAnimationFrame(() => {
      fill.style.width = progress + '%';
    });

    return section;
  }

  // ---- 挂载：插到 #app 里，隐藏其他屏 ----
  const app = $('app');
  if (!app) return;

  const boost = buildBoostScreen();
  app.appendChild(boost);

  const SCREENS = ['entry', 'scan', 'game', 'ending'];
  SCREENS.forEach((id) => {
    const el = $(id);
    if (el) el.hidden = true;
  });
  window.scrollTo({ top: 0, behavior: 'auto' });

  // 助力完成后：把对方进度推进一点，并引导来访者自己也玩
  let helped = false;

  function markHelped() {
    helped = true;
    let current = friendCash;
    current = Math.min(GOAL, Number((current + HELP_GAIN).toFixed(2)));

    const fill = boost.querySelector('.boost-track > span');
    const amount = boost.querySelector('.boost-amount strong');
    const gapEl = boost.querySelector('.boost-gap');

    amount.textContent = fmt(current);
    fill.style.width = Math.min(99.98, (current / GOAL) * 100) + '%';
    const gap = Math.max(0, GOAL - current);
    gapEl.textContent = gap <= 0 ? 'TA 已经攒满啦！' : '还差 ¥' + fmt(gap);

    const btn = $('boostHelpBtn');
    btn.disabled = true;
    btn.textContent = '✓ 助力成功，感谢你';

    // 换成「自己也去玩」的引导块
    const done = document.createElement('div');
    done.className = 'boost-done';
    done.innerHTML = [
      '<b>助力成功！</b>',
      '<span>你帮好友推进了 ¥' + fmt(HELP_GAIN) + '。要不要也来试试手气，看看自己能抽到多少？</span>',
    ].join('');
    const actions = boost.querySelector('.boost-actions');
    actions.parentNode.insertBefore(done, actions);

    const skip = $('boostSkipBtn');
    skip.textContent = '我也去抽一次 ›';
    skip.focus();
  }

  function goPlay() {
    // 交给原有页面：显示入口页
    SCREENS.forEach((id) => {
      const el = $(id);
      if (el) el.hidden = id !== 'entry';
    });
    boost.hidden = true;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  $('boostHelpBtn').addEventListener('click', markHelped);
  $('boostSkipBtn').addEventListener('click', goPlay);

  // Esc 也能跳过（桌面端）
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !boost.hidden) goPlay();
  });
})();

/*
 * Переключатель стиля оформления (общий сайт с двумя оформлениями). Подключён на обоих сайтах: у приложения —
 * ./switch/site-switch.js (в /app/), у классического — свой экземпляр рядом с его index.html (его патчит
 * scripts/assemble-classic.ts), поэтому написан на чистом JS без сборки.
 *
 *  - клик по любой ссылке с data-site-switch: круговая волна цвета сайта, на который переходим, затем переход;
 *  - на новой странице тот же слой уже закрывает экран и «схлопывается» в точку клика — получается одно движение
 *    через две страницы. Параметры волны (точка, цвета, тема) передаются через sessionStorage;
 *  - в классическом оформлении сам добавляет кнопку в ряд кнопок его шапки (рядом с GitHub), в его же стиле;
 *  - «уменьшить движение» — без анимации, просто переход.
 * Подключать в <head> обычным (не module/defer) скриптом: слой открытия должен появиться до первой отрисовки.
 */
(function () {
  'use strict';

  var KEY = 'm3102:switch';
  // Сторону помечает сам сайт: <html data-site-style="modern|classic"> (классическому её ставит classicPatch.ts)
  var side = document.documentElement.getAttribute('data-site-style') === 'classic' ? 'classic' : 'modern';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canAnimate = !reduce && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  var EASE = 'cubic-bezier(0.65, 0, 0.2, 1)';

  // Облик сайтов — для слоя перехода (на странице назначения он должен выглядеть так же, как при уходе)
  var LOOKS = {
    modern: {
      name: 'Переключаем стиль',
      sub: 'тот же сайт, другое оформление',
      accent: '#6372f5',
      accent2: '#8b95ff',
      dark: { bg: '#131315', text: '#ededef' },
      light: { bg: '#ffffff', text: '#18181b' },
      font: "'Unbounded Variable', 'Inter Variable', Inter, system-ui, sans-serif",
    },
    classic: {
      name: 'Переключаем стиль',
      sub: 'тот же сайт, другое оформление',
      accent: '#5b5fef',
      accent2: '#7c7ffb',
      dark: { bg: '#0f1016', text: '#eef0f7' },
      light: { bg: '#f4f5fa', text: '#1a1c24' },
      font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },
  };

  function isDark() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  }

  /** Акценты сайта, с которого уходим (у приложения — выбранные в настройках, у классического — его выбранный акцент) */
  function currentAccents() {
    var look = LOOKS[side];
    var css = getComputedStyle(document.documentElement);
    var names = side === 'classic' ? ['--accent', '--accent2'] : ['--accent-base', '--accent-base-2'];
    var a = css.getPropertyValue(names[0]).trim();
    var b = css.getPropertyValue(names[1]).trim();
    return { a: a || look.accent, b: b || look.accent2 };
  }

  function farthest(x, y) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    return Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) + 12;
  }

  function circle(r, x, y) {
    return 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)';
  }

  /** Слой перехода: нижний — акцентный, верхний — фон сайта назначения с названием. Оба — на весь экран. */
  function buildVeil(look, colors, acc) {
    var root = document.createElement('div');
    root.setAttribute('data-site-veil', '');
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:all;overflow:hidden;';
    var lead = document.createElement('div');
    lead.style.cssText = 'position:absolute;inset:0;background:linear-gradient(135deg,' + acc.a + ',' + acc.b + ');';
    var body = document.createElement('div');
    body.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;' +
      'background:radial-gradient(60vmax 60vmax at 50% 38%,color-mix(in srgb,' + acc.a + ' 20%,transparent),transparent 70%),' + colors.bg + ';' +
      'color:' + colors.text + ';font-family:' + look.font + ';text-align:center;';
    var title = document.createElement('div');
    title.textContent = look.name;
    title.style.cssText = 'font-size:clamp(28px,6vw,52px);font-weight:700;letter-spacing:-0.03em;line-height:1.1;';
    var rule = document.createElement('div');
    rule.style.cssText = 'width:72px;height:3px;border-radius:3px;background:linear-gradient(90deg,' + acc.a + ',' + acc.b + ');';
    var sub = document.createElement('div');
    sub.textContent = look.sub;
    sub.style.cssText = 'font-size:15px;opacity:0.65;';
    body.appendChild(title);
    body.appendChild(rule);
    body.appendChild(sub);
    root.appendChild(lead);
    root.appendChild(body);
    return { root: root, lead: lead, body: body, text: [title, rule, sub] };
  }

  /* ---------- Уход: волна раскрывается из точки клика, затем переход ---------- */
  var leaving = false;

  function go(url, x, y) {
    if (leaving) return;
    leaving = true;
    var target = side === 'modern' ? 'classic' : 'modern';
    var look = LOOKS[target];
    var colors = isDark() ? look.dark : look.light;
    var acc = currentAccents();
    var payload = { x: x, y: y, to: target, colors: colors, acc: acc, dark: isDark(), t: Date.now() };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(payload));
    } catch (e) {
      /* без хранилища просто не будет схлопывания на новой странице */
    }
    if (!canAnimate) {
      location.href = url;
      return;
    }
    var veil = buildVeil(look, colors, acc);
    veil.lead.style.clipPath = circle(0, x, y);
    veil.body.style.clipPath = circle(0, x, y);
    veil.text.forEach(function (node) {
      node.style.opacity = '0';
    });
    document.documentElement.appendChild(veil.root);
    var r = farthest(x, y);
    var open = { duration: 620, easing: EASE, fill: 'forwards' };
    veil.lead.animate([{ clipPath: circle(0, x, y) }, { clipPath: circle(r, x, y) }], open);
    var bodyAnim = veil.body.animate([{ clipPath: circle(0, x, y) }, { clipPath: circle(r, x, y) }], {
      duration: 620,
      easing: EASE,
      fill: 'forwards',
      delay: 110,
    });
    veil.text.forEach(function (node, i) {
      node.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: node === veil.text[2] ? 0.65 : 1, transform: 'translateY(0)' }], {
        duration: 320,
        easing: 'ease-out',
        fill: 'forwards',
        delay: 420 + i * 70,
      });
    });
    var done = false;
    function navigate() {
      if (done) return;
      done = true;
      location.href = url;
    }
    bodyAnim.onfinish = function () {
      setTimeout(navigate, 140);
    };
    setTimeout(navigate, 1600); // страховка: если анимация почему-то не завершилась
  }

  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest ? event.target.closest('[data-site-switch]') : null;
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    var rect = link.getBoundingClientRect();
    var x = event.clientX || rect.left + rect.width / 2;
    var y = event.clientY || rect.top + rect.height / 2;
    go(link.href, x, y);
  });

  /* ---------- Приход: слой уже закрывает экран, схлопывается в точку клика ---------- */
  function takePayload() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      sessionStorage.removeItem(KEY);
      var data = JSON.parse(raw);
      return data && data.to === side && Date.now() - data.t < 8000 ? data : null;
    } catch (e) {
      return null;
    }
  }

  var arrival = takePayload();
  // Тема приходит вместе с переходом: в классическое оформление — наша, чтобы не было смены светлой на тёмную
  if (arrival && side === 'classic' && arrival.dark !== undefined) {
    document.documentElement.setAttribute('data-theme', arrival.dark ? 'dark' : 'light');
  }

  if (arrival && canAnimate) {
    var veil = buildVeil(LOOKS[side], arrival.colors, arrival.acc || { a: LOOKS[side].accent, b: LOOKS[side].accent2 });
    document.documentElement.appendChild(veil.root);
    var started = Date.now();
    var revealed = false;

    var reveal = function () {
      if (revealed) return;
      revealed = true;
      var wait = Math.max(0, 260 - (Date.now() - started));
      setTimeout(function () {
        requestAnimationFrame(function () {
          var x = arrival.x;
          var y = arrival.y;
          var r = farthest(x, y);
          veil.text.forEach(function (node) {
            node.animate([{ opacity: node === veil.text[2] ? 0.65 : 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
          });
          veil.body.animate([{ clipPath: circle(r, x, y) }, { clipPath: circle(0, x, y) }], {
            duration: 640,
            easing: EASE,
            fill: 'forwards',
            delay: 120,
          });
          var last = veil.lead.animate([{ clipPath: circle(r, x, y) }, { clipPath: circle(0, x, y) }], {
            duration: 640,
            easing: EASE,
            fill: 'forwards',
            delay: 230,
          });
          last.onfinish = function () {
            veil.root.remove();
          };
        });
      }, wait);
    };

    if (document.readyState === 'complete') reveal();
    else window.addEventListener('load', reveal);
    setTimeout(reveal, 3000); // тяжёлая страница не должна держать экран закрытым
    setTimeout(function () {
      veil.root.remove();
    }, 6000);
  }

  // Назад по истории из bfcache: застрявший слой не нужен
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    leaving = false;
    var stale = document.querySelectorAll('[data-site-veil]');
    for (var i = 0; i < stale.length; i++) stale[i].remove();
  });

  /* ---------- Кнопка в классическом оформлении: в ряду кнопок его шапки, как его же «GitHub» ---------- */
  if (side !== 'classic') return;

  var ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>';

  // Размеры и форма — от его класса .gh-link; цвет — его акцент (фиолетовая заливка), чтобы переключатель было видно сразу
  var CSS =
    '.m3102-switch-btn{width:auto;padding:0 12px;gap:8px;grid-auto-flow:column;font:600 .82rem -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;cursor:pointer;text-decoration:none;}' +
    '.gh-link.m3102-switch-btn{background:linear-gradient(135deg,var(--accent,#5b5fef),var(--accent2,#7c7ffb));border-color:transparent;color:#fff;' +
    'box-shadow:0 6px 16px -8px var(--accent,#5b5fef);}' +
    '.gh-link.m3102-switch-btn:hover{color:#fff;border-color:transparent;filter:brightness(1.08);box-shadow:0 10px 20px -8px var(--accent,#5b5fef);}' +
    '.m3102-switch-btn svg{width:18px;height:18px;flex:none;}' +
    '.m3102-switch-btn span{white-space:nowrap;}' +
    '@media (max-width:1100px){.m3102-switch-btn{width:40px;padding:0;}.m3102-switch-btn span{display:none;}}' +
    '@media (max-width:640px){.m3102-switch-btn{width:38px;}}' +
    '.m3102-switch-btn.m3102-floating{position:fixed;top:10px;right:10px;z-index:50;width:40px;padding:0;}' +
    // Между телефонной раскладкой (до 760 px) и ноутбучной шапка классического сайта не помещается (горизонтальный телефон,
    // узкое окно): правая часть с поиском и кнопками уезжает за край. Уплотняем вкладки и поиск, чтобы кнопки остались на экране
    '@media(min-width:761px) and (max-width:1100px){.tab [data-icon]{display:none}.tab{padding:10px 6px}.tabs{gap:0}}' +
    '@media(min-width:761px) and (max-width:860px){.ss-box{width:100px}.ss-box kbd{display:none}.brand-logo{height:20px}header{gap:6px}}' +
    '@media print{.m3102-switch-btn{display:none !important;}}';

  function mount() {
    if (document.querySelector('.m3102-switch-btn')) return;
    var style = document.createElement('style');
    style.setAttribute('data-site-switch-style', '');
    style.textContent = CSS;
    document.head.appendChild(style);
    var link = document.createElement('a');
    // На Pages классический сайт в корне, приложение — в ./app/; в dev (npm run dev) наоборот: приложение на /, классический в /classic/
    link.href = /\/classic(\/|$)/.test(location.pathname) ? '../' : './app/';
    link.className = 'gh-link m3102-switch-btn';
    link.setAttribute('data-site-switch', '');
    link.title = 'Переключить стиль оформления';
    link.setAttribute('aria-label', 'Переключить стиль');
    link.innerHTML = ICON + '<span>Переключить стиль</span>';
    var actions = document.querySelector('header .header-actions');
    if (actions) actions.insertBefore(link, actions.querySelector('.gh-link'));
    else {
      // Разметка классического сайта изменилась — кнопка всё равно должна быть: плавающая в углу
      link.className += ' m3102-floating';
      document.body.appendChild(link);
    }
  }

  function ensure() {
    var link = document.querySelector('.m3102-switch-btn');
    if (link && link.isConnected) return;
    var style = document.querySelector('style[data-site-switch-style]');
    if (style) style.remove();
    mount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure);
  else ensure();
  // Его скрипты достраивают шапку (поиск и др.) — если они заменят блок с нашей кнопкой, возвращаем её на место
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      ensure();
    }, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();

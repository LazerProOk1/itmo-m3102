const HOG = `<svg class="bgfx-hog" viewBox="0 0 760 700" preserveAspectRatio="xMaxYMid meet">
<defs>
  <linearGradient id="bgfx-g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b79cff"/><stop offset="1" stop-color="#5a3fd6"/></linearGradient>
  <linearGradient id="bgfx-g2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8f73ff"/><stop offset="1" stop-color="#2f2190"/></linearGradient>
</defs>
<path id="bgfx-body" fill="url(#bgfx-g1)" d="M80 560 L20 400 L140 420 L110 250 L250 330 L260 150 L370 270 L420 70 L500 230 L590 90 L620 240 L700 200 L760 330 L760 640 L560 660 L300 640Z"/>
<path fill="url(#bgfx-g2)" opacity=".75" transform="translate(76 70) scale(.9)" d="M80 560 L20 400 L140 420 L110 250 L250 330 L260 150 L370 270 L420 70 L500 230 L590 90 L620 240 L700 200 L760 330 L760 640 L560 660 L300 640Z"/>
<circle cx="660" cy="395" r="21" fill="#fff" fill-opacity=".55"/>
</svg>`;

export function installBackdrop() {
  if (document.querySelector('.bgfx')) return;
  document.body.insertAdjacentHTML('afterbegin',
    `<div class="bgfx" aria-hidden="true"><div class="bgfx-glow"></div>${HOG}<div class="bgfx-stripes tl"></div><div class="bgfx-stripes br"></div><div class="bgfx-shade"></div></div>`);
}

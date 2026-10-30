// The goblin, drawn as a three-ink risograph print. Pure string building, no DOM,
// so the Pages game and the Node card renderer share exactly the same art.

export const THEMES = {
  light: { paper: '#f3eee3', green: '#00a95c', pink: '#ff48b0', ink: '#232340', blend: 'multiply', grain: 0.22 },
  dark:  { paper: '#16151d', green: '#19c27a', pink: '#ff5fbe', ink: '#f3eee3', blend: 'screen', grain: 0.12 }
};

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Small deterministic PRNG so the hoard pile looks the same on every render.
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909), (s ^= s >>> 16) >>> 0) / 4294967296);
}

// Patterns and filters, namespaced by prefix so several goblins can share a page.
export function defs(p, theme = 'light') {
  const t = THEMES[theme];
  return `<defs>
  <pattern id="${p}-dg" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="2" cy="2" r="1.35" fill="${t.green}"/></pattern>
  <pattern id="${p}-dg2" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="1.6" cy="1.6" r="1.25" fill="${t.green}"/></pattern>
  <pattern id="${p}-dp" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(72)"><circle cx="2" cy="2" r="1.1" fill="${t.pink}"/></pattern>
  <pattern id="${p}-di" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><circle cx="1.5" cy="1.5" r="0.7" fill="${t.ink}"/></pattern>
  <filter id="${p}-grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${t.grain * 2.2} -${t.grain}"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
  <filter id="${p}-rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3"/>
    <feDisplacementMap in="SourceGraphic" scale="1.6"/>
  </filter>
</defs>`;
}

// Accessories unlock with the hoard level, so a busy org's goblin visibly grows up.
export const ACCESSORIES = [
  { level: 3, id: 'glasses', name: 'Reading glasses' },
  { level: 6, id: 'phones', name: 'Noise-cancelling ears' },
  { level: 10, id: 'braces', name: 'Crown of braces' },
  { level: 18, id: 'cape', name: 'Cape of diffs' },
  { level: 30, id: 'halo', name: 'Halo of commits' }
];
export const accessoriesFor = level => ACCESSORIES.filter(a => level >= a.level).map(a => a.id);

function hoard(p, t, level, seed) {
  const r = rng(seed * 31 + level);
  const n = Math.min(46, 8 + level * 2);
  const items = [];
  for (let i = 0; i < n; i++) {
    const spread = 46 + Math.min(70, level * 3);
    const x = 120 + (r() - 0.5) * 2 * spread * (1 - i / (n * 1.6));
    const y = 238 - Math.pow(r(), 1.4) * Math.min(46, 24 + level * 1.4) - (i / n) * 6;
    const rot = Math.round((r() - 0.5) * 70);
    if (r() < 0.55) {
      // scroll: paper roll with an ink edge and a pink tie
      items.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})">
        <rect x="-11" y="-4" width="22" height="8" rx="4" fill="${t.paper}" stroke="${t.ink}" stroke-width="1.1"/>
        <path d="M-6 -1.5h9M-6 1.5h6" stroke="${t.ink}" stroke-width=".7" opacity=".7"/>
        <rect x="4" y="-4.5" width="2.4" height="9" fill="${t.pink}" style="mix-blend-mode:${t.blend}"/></g>`);
    } else {
      // coin, minted from deleted lines
      items.push(`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
        <ellipse rx="6.5" ry="4.2" fill="url(#${p}-dg2)" stroke="${t.ink}" stroke-width="1"/>
        <path d="M-2.4 0h4.8" stroke="${t.ink}" stroke-width="1"/></g>`);
    }
  }
  return `<g class="g-hoard">${items.join('')}</g>`;
}

// mood: 'idle' | 'happy' | 'chomp' | 'shock'. look: {x,y} in -1..1 for pupils.
export function goblin({ p = 'gob', theme = 'light', level = 1, mood = 'idle', look = { x: 0, y: 0 }, seed = 1, misreg = { x: 1.2, y: -0.9 } } = {}) {
  const t = THEMES[theme], acc = accessoriesFor(level), B = `style="mix-blend-mode:${t.blend}"`;
  const lx = (look.x || 0) * 3.2, ly = (look.y || 0) * 2.6;
  const mouth = mood === 'chomp'
    ? `<ellipse cx="121" cy="125" rx="15" ry="8" fill="${t.ink}"/><rect x="112" y="118" width="5" height="5" fill="${t.paper}"/><rect x="125" y="118" width="5" height="5" fill="${t.paper}"/>`
    : mood === 'shock'
      ? `<ellipse cx="121" cy="126" rx="6" ry="6" fill="${t.ink}"/>`
      : `<path d="M100 121 Q121 ${mood === 'happy' ? 138 : 133} 143 119" fill="none" stroke="${t.ink}" stroke-width="2.6" stroke-linecap="round"/>
         <path d="M126 126 l1.3 5.6 l4 -1 l-0.7 -5.6 z" fill="${t.paper}" stroke="${t.ink}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const browY = mood === 'shock' ? -4 : mood === 'happy' ? -2 : 0;

  const cape = acc.includes('cape') ? `<g class="g-cape">
    <path d="M86 136 C60 160 52 200 46 236 L194 236 C188 200 180 160 154 136 Z" fill="url(#${p}-dg)" ${B}/>
    <g font-family="ui-monospace,Menlo,monospace" font-size="9" fill="${t.ink}" opacity=".55">
      <text x="62" y="206">+ ship</text><text x="140" y="214">- cruft</text><text x="70" y="226">+ +</text><text x="150" y="190">-</text></g></g>` : '';

  // green plate: skin
  const green = `<g class="g-plate g-green" ${B}>
    <path class="g-ear g-ear-l" d="M84 86 C64 78 38 66 14 50 C32 74 54 95 82 105 Z" fill="url(#${p}-dg)"/>
    <path class="g-ear g-ear-r" d="M156 86 C176 78 202 66 226 50 C208 74 186 95 158 105 Z" fill="url(#${p}-dg)"/>
    <path d="M78 102 C74 68 96 50 120 50 C144 50 166 68 162 102 C160 124 142 135 120 135 C98 135 80 124 78 102 Z" fill="url(#${p}-dg)"/>
    <path d="M90 70 C100 58 116 55 128 57 C114 60 102 66 96 76 Z" fill="${t.green}" opacity=".9"/>
    <circle cx="82" cy="180" r="9" fill="${t.green}"/><circle cx="158" cy="180" r="9" fill="${t.green}"/>
    <rect x="93" y="149" width="54" height="18" rx="2" fill="url(#${p}-dg2)"/>
  </g>`;

  // pink plate: hoodie, inner ears, nose, cheeks; printed slightly off-register
  const pink = `<g class="g-plate g-pink" transform="translate(${misreg.x} ${misreg.y})" ${B}>
    <path d="M82 92 C66 86 48 77 30 64 C44 81 62 93 82 100 Z" fill="url(#${p}-dp)"/>
    <path d="M158 92 C174 86 192 77 210 64 C196 81 178 93 158 100 Z" fill="url(#${p}-dp)"/>
    <path class="g-body" d="M84 132 C68 150 64 180 66 212 L174 212 C176 180 172 150 156 132 C146 141 132 145 120 145 C108 145 94 141 84 132 Z" fill="${t.pink}"/>
    <path d="M117 95 C113 106 114 115 123 119 C129 121 132 114 127 109 C124 105 123 100 122 95 Z" fill="${t.pink}"/>
    <ellipse cx="96" cy="108" rx="7" ry="4.5" fill="url(#${p}-dp)"/><ellipse cx="146" cy="108" rx="7" ry="4.5" fill="url(#${p}-dp)"/>
    ${acc.includes('phones') ? `<rect x="70" y="84" width="12" height="22" rx="5" fill="${t.pink}"/><rect x="158" y="84" width="12" height="22" rx="5" fill="${t.pink}"/>` : ''}
    ${acc.includes('braces') ? `<text x="120" y="44" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="700" font-size="30" fill="${t.pink}">{ }</text>` : ''}
  </g>`;

  // ink plate: line work, eyes, laptop
  const ink = `<g class="g-plate g-ink">
    <path d="M78 102 C74 68 96 50 120 50 C144 50 166 68 162 102 C160 124 142 135 120 135 C98 135 80 124 78 102 Z" fill="none" stroke="${t.ink}" stroke-width="1.6" filter="url(#${p}-rough)"/>
    <path d="M84 86 C64 78 38 66 14 50 C32 74 54 95 82 105" fill="none" stroke="${t.ink}" stroke-width="1.4" filter="url(#${p}-rough)"/>
    <path d="M156 86 C176 78 202 66 226 50 C208 74 186 95 158 105" fill="none" stroke="${t.ink}" stroke-width="1.4" filter="url(#${p}-rough)"/>
    <g class="g-eyes">
      <ellipse cx="104" cy="91" rx="9.5" ry="10.5" fill="${t.paper}" stroke="${t.ink}" stroke-width="1.6"/>
      <ellipse cx="137" cy="91" rx="9.5" ry="10.5" fill="${t.paper}" stroke="${t.ink}" stroke-width="1.6"/>
      <g class="g-pupils" transform="translate(${lx.toFixed(2)} ${ly.toFixed(2)})"><circle cx="104" cy="92" r="4.3" fill="${t.ink}"/><circle cx="137" cy="92" r="4.3" fill="${t.ink}"/>
        <circle cx="105.6" cy="90.4" r="1.2" fill="${t.paper}"/><circle cx="138.6" cy="90.4" r="1.2" fill="${t.paper}"/></g>
      <g class="g-lids"><rect x="93" y="79" width="22" height="0" fill="url(#${p}-dg)"/><rect x="126" y="79" width="22" height="0" fill="url(#${p}-dg)"/></g>
    </g>
    <path d="M93 ${76 + browY} Q104 ${70 + browY} 115 ${77 + browY}" fill="none" stroke="${t.ink}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M127 ${77 + browY} Q138 ${69 + browY} 149 ${74 + browY}" fill="none" stroke="${t.ink}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M117 95 C113 106 114 115 123 119 C129 121 132 114 127 109" fill="none" stroke="${t.ink}" stroke-width="1.4"/>
    <g class="g-mouth">${mouth}</g>
    <path d="M86 134 C98 146 142 146 154 134" fill="none" stroke="${t.ink}" stroke-width="1.4" opacity=".8"/>
    <path d="M108 146 v14 M132 146 v14" stroke="${t.ink}" stroke-width="1.2"/><circle cx="108" cy="161" r="1.8" fill="${t.ink}"/><circle cx="132" cy="161" r="1.8" fill="${t.ink}"/>
    <g class="g-laptop">
      <path d="M91 148 L149 148 L152 168 L88 168 Z" fill="none" stroke="${t.ink}" stroke-width="1.6"/>
      <path d="M80 168 L160 168 L166 182 L74 182 Z" fill="${t.ink}"/>
      <path class="g-code" d="M98 154 h14 M98 158 h24 M98 162 h10 M116 162 h16" stroke="${t.ink}" stroke-width="1.3" stroke-linecap="round"/>
    </g>
    ${acc.includes('glasses') ? `<g fill="none" stroke="${t.ink}" stroke-width="2"><circle cx="104" cy="91" r="13"/><circle cx="137" cy="91" r="13"/><path d="M117 89 q3.5 -3 7 0"/></g>` : ''}
    ${acc.includes('phones') ? `<path d="M76 88 C74 46 166 46 164 88" fill="none" stroke="${t.ink}" stroke-width="3.2"/>` : ''}
    ${acc.includes('halo') ? `<g class="g-halo">${Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return `<circle cx="${(120 + Math.cos(a) * 34).toFixed(1)}" cy="${(30 + Math.sin(a) * 7).toFixed(1)}" r="2.2" fill="${i % 3 ? t.ink : t.pink}"/>`; }).join('')}</g>` : ''}
  </g>`;

  return `<g class="goblin mood-${mood}">${cape}${hoard(p, t, level, seed)}<g class="g-figure">${green}${pink}${ink}</g></g>`;
}

// CSS animations shared by the card and the game. Respect reduced motion.
export function goblinCSS(scope = '') {
  return `
${scope} .g-figure{transform-box:fill-box;transform-origin:50% 100%;animation:g-breathe 3.6s ease-in-out infinite}
${scope} .g-ear-l{transform-box:fill-box;transform-origin:100% 60%;animation:g-twitch 7s ease-in-out infinite}
${scope} .g-ear-r{transform-box:fill-box;transform-origin:0% 60%;animation:g-twitch 7s ease-in-out infinite 3.1s}
${scope} .g-lids rect{animation:g-blink 5.5s infinite}
${scope} .g-pink{animation:g-misreg 9s steps(3) infinite}
${scope} .g-code{stroke-dasharray:60;animation:g-type 2.4s steps(6) infinite}
${scope} .g-halo{transform-box:fill-box;transform-origin:50% 50%;animation:g-spin 14s linear infinite}
@keyframes g-breathe{50%{transform:scale(1.012,.985)}}
@keyframes g-twitch{0%,92%,100%{transform:rotate(0)}95%{transform:rotate(-7deg)}97%{transform:rotate(3deg)}}
@keyframes g-blink{0%,94%,100%{height:0}96%{height:24px}}
@keyframes g-misreg{0%,100%{translate:0 0}33%{translate:.6px .4px}66%{translate:-.4px .7px}}
@keyframes g-type{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}
@keyframes g-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){${scope} *{animation:none!important}}`;
}

#!/usr/bin/env node
// Plan 10 §13 dual-viewport audit driven over CDP against the real running app.
// Desktop 1280x800, mobile 360x800 (narrowest supported) + 390x844 (iPhone 14 Pro).
import http from 'node:http';

const PORT = Number(process.env.CDP_PORT || 9333);
const APP = process.env.APP_URL || 'http://localhost:3002/';

function httpJson(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path, method }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

class Cdp {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); }
  async open() {
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', rej, { once: true });
    });
    this.ws.addEventListener('message', ev => {
      const m = JSON.parse(ev.data);
      if (!m.id) return;
      const p = this.pending.get(m.id);
      if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    });
  }
  call(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }
  async eval(expression) {
    const r = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
    return r.result.value;
  }
}

const AUDIT = `(() => {
  const vis = e => { const r=e.getBoundingClientRect(), s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none'; };
  // Accessible name must consider <label for>/wrapping <label> and aria-labelledby,
  // not just aria-label/textContent — form controls have empty textContent.
  const label = e => {
    const byId = e.getAttribute('aria-labelledby');
    const name = e.getAttribute('aria-label')
      || (byId && document.getElementById(byId)?.textContent)
      || (e.labels && e.labels[0] && e.labels[0].textContent)
      || e.textContent
      || e.title
      || '';
    return name.trim().replace(/\s+/g,' ').slice(0,70) || e.tagName;
  };

  // WCAG: computed bg lies for transparent elements — walk the parent chain.
  const effBg = el => {
    let c = el;
    while (c) { const b = getComputedStyle(c).backgroundColor;
      if (b && b !== 'rgba(0, 0, 0, 0)' && !/rgba\\(.*,\\s*0\\)$/.test(b)) return b;
      c = c.parentElement; }
    return getComputedStyle(document.body).backgroundColor;
  };
  const parse = s => { const m = s.match(/\\d+(\\.\\d+)?/g); return m ? m.slice(0,3).map(Number) : null; };
  const lum = ([r,g,b]) => { const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const ratio = (fg,bg) => { const a=parse(fg), b=parse(bg); if(!a||!b) return null;
    // Raw ratio: rounding before the threshold comparison can promote a failing
    // value (e.g. 2.9953 -> 3.00) into a pass. Round only when reporting.
    const l1=Math.max(lum(a),lum(b)), l2=Math.min(lum(a),lum(b)); return (l1+0.05)/(l2+0.05); };

  const interactive = [...document.querySelectorAll('button,a[href],input,textarea,select,summary,[role="button"],[role="tab"],[tabindex]:not([tabindex="-1"])')].filter(vis);

  const contrast = [];
  for (const el of [...document.querySelectorAll('p,span,label,button,a,h1,h2,h3,h4,li,small,summary,div')].filter(vis)) {
    const text = (el.textContent||'').trim();
    if (!text || el.children.length > 0) continue;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight,10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const r = ratio(cs.color, effBg(el));
    if (r !== null && r < (large ? 3 : 4.5)) {
      contrast.push({ text: text.slice(0,45), size, ratio: +r.toFixed(2), need: large?3:4.5, color: cs.color, bg: effBg(el) });
    }
  }

  return {
    viewport: [innerWidth, innerHeight],
    lang: document.documentElement.lang,
    viewportMeta: document.querySelector('meta[name="viewport"]')?.content,
    horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
    overflowingElements: [...document.querySelectorAll('*')].filter(e => vis(e) && e.getBoundingClientRect().right > innerWidth + 1)
      .slice(0,8).map(e => ({ cls: (e.className||'').toString().slice(0,50), right: +e.getBoundingClientRect().right.toFixed(1) })),
    mainCount: document.querySelectorAll('main').length,
    landmarks: [...document.querySelectorAll('main,nav,header,footer,aside,[role="region"]')].filter(vis)
      .map(e => e.tagName.toLowerCase() + (e.getAttribute('aria-label') ? ':'+e.getAttribute('aria-label').slice(0,30) : '')),
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(vis).map(e => e.tagName + ':' + label(e)),
    sectionOrder: [...document.querySelectorAll('.object-stage,.source-workbench-wrap,.counter-column,.provenance-module,.caption-turn')]
      .filter(vis).map(e => ({ cls: e.className.toString().split(' ')[0], y: +e.getBoundingClientRect().y.toFixed(0) }))
      .sort((a,b) => a.y - b.y),
    stageActions: [...document.querySelectorAll('.caption-turn button')].map(e => ({ label: label(e), disabled: e.disabled })),
    primaryAction: document.querySelector('.caption-turn')?.dataset.primaryAction,
    smallTargets: interactive.map(e => { const r = e.getBoundingClientRect();
        return { label: label(e), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })
      .filter(t => t.w < 44 || t.h < 44),
    interactiveCount: interactive.length,
    tabOrder: interactive.slice(0,30).map(e => label(e)),
    unlabelledControls: interactive.filter(e => label(e) === e.tagName).map(e => e.outerHTML.slice(0,80)),
    tabs: [...document.querySelectorAll('[role="tab"]')].map(e => ({ label: label(e), controls: e.getAttribute('aria-controls'), selected: e.getAttribute('aria-selected'), tabIndex: e.tabIndex })),
    panels: [...document.querySelectorAll('[role="tabpanel"]')].map(e => ({ id: e.id, labelledBy: e.getAttribute('aria-labelledby') })),
    sliders: [...document.querySelectorAll('input[type="range"]')].map(e => ({ label: label(e), accessibleName: e.getAttribute('aria-label') || document.querySelector('label[for="'+e.id+'"]')?.textContent?.trim(), min: e.min, max: e.max, value: e.value })),
    liveRegions: [...document.querySelectorAll('[aria-live]')].map(e => ({ live: e.getAttribute('aria-live'), atomic: e.getAttribute('aria-atomic') })),
    imagesWithoutAlt: [...document.querySelectorAll('img')].filter(e => !e.hasAttribute('alt')).map(e => (e.src||'').slice(-50)),
    stationCount: document.querySelectorAll('.teppanyaki-station').length,
    stationDetails: document.querySelectorAll('.teppanyaki-station-details').length,
    counterText: (document.querySelector('.teppanyaki-counter')?.innerText || '').slice(0,160),
    contrastFailures: contrast.slice(0,12),
  };
})()`;

const target = await httpJson('/json/new?' + encodeURIComponent(APP), 'PUT');
const cdp = new Cdp(target.webSocketDebuggerUrl);
await cdp.open();
await cdp.call('Page.enable');
await cdp.call('Runtime.enable');

for (let i = 0; ; i++) {
  if (await cdp.eval(`Boolean(document.querySelector('.object-stage'))`)) break;
  if (i === 79) {
    const d = await cdp.eval(`({ url: location.href, text: document.body.innerText.slice(0,200) })`);
    throw new Error('gallery stage never rendered: ' + JSON.stringify(d));
  }
  await new Promise(r => setTimeout(r, 250));
}

async function at(width, height, mobile) {
  await cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await new Promise(r => setTimeout(r, 400));
  return cdp.eval(AUDIT);
}

const out = {
  desktop_1280: await at(1280, 800, false),
  mobile_390: await at(390, 844, true),
  mobile_360: await at(360, 800, true),
};

// Reduced-motion is a media-query concern, checked separately.
await cdp.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await new Promise(r => setTimeout(r, 300));
out.reducedMotion = await cdp.eval(`(() => {
  const vis = e => { const r=e.getBoundingClientRect(); return r.width>0&&r.height>0; };
  const animated = [...document.querySelectorAll('*')].filter(vis).map(e => {
    const s = getComputedStyle(e);
    return { cls: (e.className||'').toString().split(' ')[0], dur: s.animationDuration, trans: s.transitionDuration };
  }).filter(x => (parseFloat(x.dur) > 0.05) || (parseFloat(x.trans) > 0.05));
  return { matches: matchMedia('(prefers-reduced-motion: reduce)').matches, stillAnimating: animated.slice(0,10), count: animated.length };
})()`);

console.log(JSON.stringify(out, null, 2));
await cdp.call('Page.close');

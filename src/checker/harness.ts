/**
 * Injected first into the runner page (SPEC-SIXTH-FORM § 5.2). The runner frame
 * has an opaque origin, so this script is the only way the builder learns what
 * the student's code did. It talks to the builder with postMessage only.
 *
 * Messages to the builder: { nb: 1, type, ... }. Requests from the builder:
 * { nb: 2, id, op, ... }, answered with { nb: 1, type: 'result', id, ... }.
 *
 * Kept as plain ES5-style JavaScript in a string: it runs inside the student's page.
 */
export const HARNESS = `(function () {
  var P = window.parent;
  function post(type, data) {
    var m = { nb: 1, type: type };
    for (var k in data) m[k] = data[k];
    try { P.postMessage(m, '*'); } catch (e) {}
  }
  function show(v) {
    try {
      if (typeof v === 'string') return v;
      if (v === undefined) return 'undefined';
      if (typeof v === 'function') return 'function ' + (v.name || '');
      if (v instanceof Element) return '<' + v.tagName.toLowerCase() + '>';
      var j = JSON.stringify(v);
      return j === undefined ? String(v) : j;
    } catch (e) { return String(v); }
  }
  function safe(v) {
    if (v === undefined) return { undef: true, display: 'undefined' };
    try { return { value: JSON.parse(JSON.stringify(v)), display: show(v) }; }
    catch (e) { return { display: show(v) }; }
  }
  var log = { alerts: [], writes: [], console: [], errors: [], reloads: 0 };
  window.alert = function (m) {
    var t = m === undefined ? '' : String(m);
    log.alerts.push(t);
    post('alert', { text: t });
  };
  window.confirm = function () { return false; };
  window.prompt = function () { return null; };
  ['log', 'info', 'warn', 'error'].forEach(function (k) {
    var orig = console[k];
    console[k] = function () {
      var t = Array.prototype.map.call(arguments, show).join(' ');
      log.console.push(t);
      post('console', { level: k, text: t });
      try { orig.apply(console, arguments); } catch (e) {}
    };
  });
  var realWrite = document.write.bind(document);
  function write(t) {
    log.writes.push(t);
    post('write', { text: t });
    if (document.readyState === 'loading') realWrite(t);
    /* After loading, document.write replaces the page. Do that without wiping this harness. */
    else if (document.body) document.body.innerHTML = t;
  }
  document.write = function () { write(Array.prototype.join.call(arguments, '')); };
  document.writeln = function () { write(Array.prototype.join.call(arguments, '') + '\\n'); };

  var loops = 0;
  window.__nbGuard = function (line) {
    if (loops === 0) setTimeout(function () { loops = 0; }, 0);
    if (++loops > 1000000) { loops = 0; throw new Error('__NB_LOOP__' + line); }
  };
  window.addEventListener('error', function (e) {
    var msg = e.message || String(e.error);
    var loop = /__NB_LOOP__(\\d+)/.exec(msg);
    log.errors.push(msg);
    post('error', { message: msg, line: e.lineno, file: e.filename || '', loopLine: loop ? Number(loop[1]) : null });
  });
  window.addEventListener('submit', function (e) {
    if (!e.defaultPrevented) {
      e.preventDefault();
      log.reloads++;
      post('reload', {});
    }
  });
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a');
    if (a && !e.defaultPrevented) {
      e.preventDefault();
      post('link', { href: a.getAttribute('href') || '' });
    }
  });

  function lookup(name) {
    if (!/^[A-Za-z_$][\\w$]*$/.test(name)) return undefined;
    try { return (0, eval)('typeof ' + name + ' === "function" ? ' + name + ' : undefined'); }
    catch (e) { return undefined; }
  }
  function text(sel) {
    var el = null;
    try { el = document.querySelector(sel); } catch (e) {}
    return el ? { found: true, text: el.textContent, html: el.innerHTML } : { found: false };
  }
  function counts() {
    return { a: log.alerts.length, w: log.writes.length, e: log.errors.length, r: log.reloads };
  }
  function since(c) {
    return {
      alerts: log.alerts.slice(c.a),
      writes: log.writes.slice(c.w),
      errors: log.errors.slice(c.e),
      reloaded: log.reloads > c.r
    };
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.nb !== 2) return;
    var reply = function (data) { data.id = d.id; post('result', data); };
    if (d.op === 'log') return reply({ log: log, title: document.title });
    if (d.op === 'call') {
      var fn = lookup(d.fn);
      if (!fn) return reply({ missing: true });
      var c = counts();
      try {
        var r = safe(fn.apply(null, d.args));
        r.side = since(c);
        return reply(r);
      } catch (err) {
        return reply({ error: String(err && err.message || err), side: since(c) });
      }
    }
    if (d.op === 'submit') {
      var form = null;
      try { form = document.querySelector(d.form); } catch (e) {}
      if (!form) form = document.forms[0] || null;
      if (!form) return reply({ noForm: true });
      var input = (d.inputName && form.elements[d.inputName]) || form.querySelector('input[type=text], input:not([type])');
      if (!input) return reply({ noInput: true });
      input.value = d.value;
      var c2 = counts();
      try {
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      } catch (err) {}
      setTimeout(function () {
        var s = since(c2);
        s.target = d.selector ? text(d.selector) : null;
        reply(s);
      }, 30);
      return;
    }
    if (d.op === 'text') return reply(text(d.selector));
    if (d.op === 'highlight') {
      var old = document.querySelectorAll('[data-nb-highlight]');
      for (var i = 0; i < old.length; i++) old[i].removeAttribute('data-nb-highlight');
      var el = null;
      try { el = d.selector ? document.querySelectorAll(d.selector)[d.index || 0] : null; } catch (e) {}
      if (el) {
        if (!document.getElementById('nb-hl')) {
          var st = document.createElement('style');
          st.id = 'nb-hl';
          st.textContent = '[data-nb-highlight]{outline:4px dashed #D9455F !important;outline-offset:3px !important}';
          (document.head || document.documentElement).appendChild(st);
        }
        el.setAttribute('data-nb-highlight', '');
        if (el.scrollIntoView) el.scrollIntoView({ block: 'center' });
      }
      return reply({ found: !!el });
    }
  });
  window.addEventListener('load', function () { post('ready', { title: document.title }); });
})();`;

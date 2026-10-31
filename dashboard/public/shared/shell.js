/* DELPHI shared shell behaviour: the theme toggle and the nav's own scroll position.
   Loaded as a plain (non-deferred) script in <head> so the stored theme is applied
   before the first paint. Every storage access is wrapped: if storage throws or is
   blocked, the page still renders and the toggle still works for this visit.

   The theme is written under both keys the site has used ('delphi-theme' and
   'theme') so pages this shell has not been applied to agree with it.

   The toggle is a delegated listener, and it stands aside when a page has put its
   own handler on the button (the 3D viewer repaints its palette there), so a page
   can adopt the shell without changing one line of its own script. */
(function () {
  'use strict';
  var KEYS = ['delphi-theme', 'theme'];

  function read() {
    for (var i = 0; i < KEYS.length; i++) {
      try {
        var v = localStorage.getItem(KEYS[i]);
        if (v === 'dark' || v === 'light') return v;
      } catch (e) { /* storage unavailable: fall through to the OS preference */ }
    }
    return null;
  }
  function write(v) {
    if (v !== 'dark' && v !== 'light') return;
    for (var i = 0; i < KEYS.length; i++) {
      try { localStorage.setItem(KEYS[i], v); } catch (e) { /* ignore */ }
    }
  }
  function announce(v) {
    try { document.dispatchEvent(new CustomEvent('delphi:theme', { detail: { theme: v } })); }
    catch (e) { /* no CustomEvent constructor: pages simply do not repaint */ }
  }

  var stored = read();
  if (stored) document.documentElement.setAttribute('data-theme', stored);

  function toggle() {
    var root = document.documentElement;
    var cur = root.getAttribute('data-theme');
    if (cur !== 'dark' && cur !== 'light') {
      cur = window.matchMedia && matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
    }
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    write(next);
    announce(next);
  }

  /* A page may already have its own handler on this button: the 3D viewer and the
     claim graph repaint their canvas there. Rather than replace it (which would
     lose the repaint) or run beside it (which would toggle twice), wrap it, so the
     page's work still happens and the choice is then stored under both keys. Done
     at load, by which time every inline page script has bound. */
  function adopt() {
    var b = document.querySelector('header.dsh [data-dsh-theme]');
    if (!b || !b.onclick || b.onclick.__dsh) return;
    var orig = b.onclick;
    var wrapped = function (e) {
      var r = orig.call(this, e);
      var v = document.documentElement.getAttribute('data-theme');
      write(v); announce(v);
      return r;
    };
    wrapped.__dsh = true;
    b.onclick = wrapped;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== document && !(t.getAttribute && t.getAttribute('data-dsh-theme') !== null)) t = t.parentNode;
    if (!t || t === document || !t.getAttribute) return;
    if (t.onclick) return;           // the page owns this button
    e.preventDefault();
    toggle();
  });

  // keep --dsh-h equal to the shell's real height, so a page's own sticky bar
  // parks directly under it instead of guessing
  function measure() {
    var h = document.querySelector('header.dsh');
    var root = document.documentElement;
    if (!h) return;
    var sticky = false;
    try { sticky = getComputedStyle(h).position === 'sticky'; } catch (e) {}
    if (sticky) root.style.setProperty('--dsh-h', Math.round(h.getBoundingClientRect().height) + 'px');
    else root.style.removeProperty('--dsh-h');
  }

  /* Bring the link for the page you are on into view inside its own scroller,
     without moving the page, and only when it is not already readable: a nav
     that scrolls itself on arrival would otherwise hide the groups at its
     start for no reason. PAD keeps the pill clear of the edge fade. */
  var PAD = 18;
  function revealCurrent() {
    var links = document.querySelectorAll('header.dsh a[aria-current="page"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i], box = a.parentNode;
      while (box && box !== document.body && !/dsh-nav|dsh-modes/.test(box.className || '')) box = box.parentNode;
      if (!box || box === document.body) continue;
      var ar = a.getBoundingClientRect(), br = box.getBoundingClientRect();
      if (ar.left >= br.left + PAD && ar.right <= br.right - PAD) continue;   // already visible
      var left = box.scrollLeft + (ar.left - br.left);                        // its offset inside the scroller
      box.scrollLeft = Math.max(0, left - Math.max(PAD, (box.clientWidth - ar.width) / 2));
    }
  }

  function ready() { measure(); revealCurrent(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();
  window.addEventListener('resize', measure);
  window.addEventListener('load', function () { measure(); adopt(); });
})();

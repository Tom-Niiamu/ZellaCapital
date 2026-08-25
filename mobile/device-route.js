/* ============================================================================
 * ZellaCapital — Centralized device-based version routing (FRONTEND ONLY)
 * ----------------------------------------------------------------------------
 * Goal: PHONE -> /mobile/<page> ; TABLET -> desktop ; COMPUTER -> desktop.
 *
 * Design notes (why it is reliable and loop-free):
 *  - Single source of truth: this is the ONLY file with routing logic. Every
 *    page just includes it; there is no duplicated routing code.
 *  - Device class is decided with reliable characteristics, NOT a bare
 *    `window.innerWidth < 768` check. Phones are detected via a mobile
 *    User-Agent; tablets are separated from phones by (a) a non-mobile UA and
 *    (b) coarse-pointer / touch + width >= ~600. This keeps iPads, Android
 *    tablets and Windows tablets on the DESKTOP build even though their width
 *    is smaller than a laptop.
 *  - No redirect loop: the decision is made once per navigation. A phone is
 *    only redirected when it is currently on a DESKTOP page that has a mobile
 *    twin, and a tablet/computer is only redirected when it is currently on a
 *    /mobile/ page that has a desktop twin. Because the target already belongs
 *    to the correct version, the routing never fires again on the landed page.
 *  - Only redirects when an equivalent page exists (MAPPED below). If a desktop
 *    page has no mobile twin, the user simply stays on the desktop page.
 *  - Authentication is untouched: we only swap the version of the SAME page and
 *    preserve the path + query string, so auth.js / Supabase auth still run on
 *    the correct page afterwards.
 *  - Backend / database / Supabase / auth are NOT modified.
 * ==========================================================================*/

(function () {
  // Pages that have BOTH a desktop and a /mobile/ twin. Used to guarantee we
  // only ever redirect to a page that actually exists (no 404s).
  var MAPPED = {
    'index.html': true,
    'product.html': true,
    'calculator.html': true,
    'wallet.html': true,
    'recharge.html': true,
    'history.html': true,
    'contract.html': true,
    'funding_details.html': true,
    'checkin.html': true,
    'chat.html': true,
    'invite.html': true,
    'news.html': true,
    'me.html': true,
    'withdrawal.html': true,
    'login.html': true,
    'signup.html': true,
    'forgot.html': true
  };

  function getPage() {
    var path = window.location.pathname;
    var segments = path.split('/');
    var last = segments[segments.length - 1] || 'index.html';
    if (last === '' || last === 'index.htm') last = 'index.html';
    return last;
  }

  function isMobileUA() {
    // NB: an iPad UA contains the substring "Mobile/" (e.g. "... Mobile/15E148
    // Safari/604.1"), so a bare `mobi` token would wrongly flag iPads as
    // phones. We therefore exclude "ipad" explicitly — iPads are TABLETS and
    // must stay on the desktop build.
    var uaLower = (navigator.userAgent || '').toLowerCase();
    if (/ipad/.test(uaLower)) return false;
    return /iphone|ipod|android.*mobile|windows phone|blackberry|bb10|mini|opera mini|mobile.*fennec|mobi/i.test(uaLower);
  }

  function coarsePointer() {
    var isCoarse = false;
    try {
      if (window.matchMedia) {
        isCoarse = window.matchMedia('(pointer: coarse)').matches ||
                   window.matchMedia('(hover: none)').matches;
      }
    } catch (e) { /* matchMedia unavailable */ }
    if (!isCoarse && 'ontouchend' in window) isCoarse = true;
    return isCoarse;
  }

  function screenWidth() {
    return window.innerWidth || document.documentElement.clientWidth || 0;
  }

  function isIPadOS() {
    // iPadOS 13+ spoofs a desktop "MacIntel" UA but still reports touch +
    // coarse pointer + multiple touch points. Treated as a TABLET (desktop build).
    return /macintosh/i.test(navigator.userAgent || '') &&
           coarsePointer() && navigator.maxTouchPoints > 1;
  }

  function isPhone() {
    // True phones (iPhone, Android phone, WinPhone, etc.) always use /mobile/.
    if (isMobileUA()) return true;

    // A non-mobile-UA device that is touch/coarse AND narrow is treated as a
    // phone only when clearly narrow (small portrait tablets excluded).
    var narrow = screenWidth() > 0 && screenWidth() < 600;
    if ((coarsePointer() || isIPadOS()) && narrow) return true;

    return false;
  }

  function isTablet() {
    if (isMobileUA()) return false; // phones excluded
    var wideTouch = coarsePointer() && screenWidth() >= 600;
    return isIPadOS() || wideTouch; // iPad / Android tablet / Windows tablet
  }

  function route() {
    var page = getPage();
    if (!MAPPED[page]) return; // Unknown / unmapped page: do nothing.

    var href = window.location.href;
    var inMobile = /\/mobile\//i.test(href);

    if (isPhone()) {
      // Phone: must be on the /mobile/ version. If currently on desktop, go to
      // the mobile twin (the twin exists because page is in MAPPED). Preserve
      // query string + hash so auth redirects (e.g. ?skip=1) survive.
      if (!inMobile) {
        // Build an ABSOLUTE target from the current origin so the redirect can
        // never resolve back to the same URL (which would cause a loop).
        var mobileTarget = window.location.origin +
          window.location.pathname.replace(/[^\/]*$/, '') +
          'mobile/' + page + window.location.search + window.location.hash;
        window.location.replace(mobileTarget);
      }
      // If already in /mobile/, stay (no loop).
      return;
    }

    // Tablet or computer: must be on the desktop version.
    if (inMobile) {
      // On a /mobile/ page -> redirect to the desktop twin (exists; in MAPPED).
      // Compute the ABSOLUTE desktop path: strip the leading "/mobile/" segment
      // from the current path, then re-append the page + query + hash. This
      // guarantees a fresh, non-looping URL (e.g. /mobile/product.html ->
      // /product.html) instead of a relative path that resolves back to itself.
      var base = window.location.pathname.replace(/\/mobile\//i, '/');
      var desktopTarget = window.location.origin + base +
        window.location.search + window.location.hash;
      window.location.replace(desktopTarget);
      return;
    }
    // Already on desktop: stay (tablet & computer both use the desktop build).
  }

  // Run as early as possible (this file is included in <head>, so it executes
  // before the body / deferred module scripts such as auth.js).
  try {
    route();
  } catch (e) {
    // On any unexpected error, fail open: leave the user on the current page.
  }
})();

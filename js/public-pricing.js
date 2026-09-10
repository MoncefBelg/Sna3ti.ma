/* ============================================================
   Sna3ti.ma — Public Pricing (REQ 57-F)
   js/public-pricing.js

   Server-driven pricing for the public index page.
   Fetches GET /plans from the backend and updates the hardcoded
   prices in the pricing cards, nav dropdown, and footer links.

   Production fallback: if the API is unreachable, the static
   HTML prices remain visible (they mirror the DB seed).

   Loaded after api-client.js + fallback-gate.js.
   ============================================================ */

(function (global) {
  "use strict";

  var Api = global.Sna3tiApi || null;

  function fetchPlans() {
    if (!Api) return Promise.resolve(null);
    return Api.__request("GET", "plans", { auth: false }).then(function (res) {
      return (res && res.data) ? res.data : null;
    }).catch(function () {
      return null;
    });
  }

  /** Update pricing card price elements ([data-sna3ti-price="free|verified|gold"]).
   *  Each element's first text node (the number) is replaced; the inner
   *  <span> for DH and <small> for /mois are preserved. */
  function updateCardPrices(plans) {
    var map = {};
    plans.forEach(function (p) { map[p.code] = p; });

    ["free", "verified", "gold"].forEach(function (code) {
      var el = document.querySelector('[data-sna3ti-price="' + code + '"]');
      if (!el || !map[code]) return;
      var price = map[code].price;
      // Walk child nodes, replace the first text node (the numeric value).
      var nodes = el.childNodes;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].nodeType === 3) { // TEXT_NODE
          nodes[i].textContent = price + " ";
          break;
        }
      }
    });
  }

  /** Update nav / footer links ([data-sna3ti-nav-price="free|verified|gold"]).
   *  Text is replaced entirely — these are short labels, not complex HTML. */
  function updateNavPrices(plans) {
    var map = {};
    plans.forEach(function (p) { map[p.code] = p; });

    var labels = {
      free:     { fr: "Gratuit — {price} DH" },
      verified: { fr: "Vérifié — {price} DH/mois" },
      gold:     { fr: "GOLD — {price} DH/mois" }
    };

    ["free", "verified", "gold"].forEach(function (code) {
      var els = document.querySelectorAll('[data-sna3ti-nav-price="' + code + '"]');
      if (!els.length || !map[code]) return;
      var price = map[code].price;
      var tpl = (labels[code] || {}).fr || "";
      var text = tpl.replace("{price}", price);
      els.forEach(function (el) {
        el.textContent = text;
      });
    });
  }

  function init() {
    fetchPlans().then(function (plans) {
      if (!plans || !plans.length) return; // leave static HTML intact
      updateCardPrices(plans);
      updateNavPrices(plans);
    });
  }

  if (global.document && global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window);

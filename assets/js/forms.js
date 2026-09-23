/*
 * Forms: property inquiry, buyers list, contact.
 * Validates in the browser, then POSTs JSON to SITE_CONFIG.FORM_ENDPOINT.
 * With no endpoint set, the payload is logged to the console and the visitor
 * still goes to the thank-you page.
 */
(function () {
  "use strict";

  var RPD = window.RPD || (window.RPD = {});
  var ROOT = RPD.ROOT || "";
  var CFG = window.SITE_CONFIG || {};
  var CONSENT_TEXT = "By submitting, you agree to receive texts and emails from Right Price Home Buyers about properties. Message/data rates may apply. Reply STOP to opt out.";
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function phoneDigits(v) {
    var d = String(v || "").replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    return d;
  }
  function validUSPhone(v) {
    var d = phoneDigits(v);
    return d.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(d);
  }
  function formatPhone(v) {
    var d = phoneDigits(v);
    if (d.length !== 10) return v;
    return "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6);
  }
  function moneyNum(v) {
    var s = String(v || "").trim().toLowerCase();
    if (!s) return null;
    var mult = /k$/.test(s) ? 1000 : /m$/.test(s) ? 1000000 : 1;
    s = s.replace(/[^0-9.]/g, "");
    return s ? parseFloat(s) * mult : null;
  }

  function fieldWrap(input) { return input.closest(".field") || input.parentNode; }
  function setError(input, msg) {
    var wrap = fieldWrap(input);
    var em = wrap.querySelector(".error-msg");
    if (!em) { em = document.createElement("div"); em.className = "error-msg"; em.id = (input.id || input.name) + "-err"; wrap.appendChild(em); }
    em.textContent = msg;
    wrap.classList.add("has-error");
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", em.id);
  }
  function clearError(input) {
    var wrap = fieldWrap(input);
    wrap.classList.remove("has-error");
    input.removeAttribute("aria-invalid");
  }

  function validate(form) {
    var firstBad = null;
    function bad(input, msg) { setError(input, msg); if (!firstBad) firstBad = input; }
    form.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (el.closest(".hp") || el.type === "hidden") return;
      clearError(el);
    });
    var groupsChecked = {};
    form.querySelectorAll("input, select, textarea").forEach(function (el) {
      if (el.closest(".hp") || el.type === "hidden" || el.disabled) return;
      var v = (el.value || "").trim();
      if ((el.type === "checkbox" || el.type === "radio") && el.hasAttribute("data-group-required")) {
        if (groupsChecked[el.name]) return;
        groupsChecked[el.name] = true;
        if (!form.querySelector('input[name="' + el.name + '"]:checked')) bad(el, el.getAttribute("data-msg") || "Please choose at least one.");
        return;
      }
      if (el.type === "checkbox") {
        var needIf = el.getAttribute("data-required-if");
        var needed = el.required || (needIf && form.elements[needIf] && form.elements[needIf].value.trim() !== "");
        if (needed && !el.checked) bad(el, el.getAttribute("data-msg") || "Please check this box to continue.");
        return;
      }
      if (el.required && !v) { bad(el, el.getAttribute("data-msg") || "This field is required."); return; }
      if (!v) return;
      if (el.type === "email" && !EMAIL_RE.test(v)) bad(el, "Please enter a valid email address.");
      else if (el.type === "tel" && !validUSPhone(v)) bad(el, "Please enter a 10-digit US phone number, e.g. (216) 555-0123.");
      else if (el.getAttribute("data-money") !== null && moneyNum(v) == null) bad(el, "Please enter a dollar amount, e.g. 150000 or 150k.");
    });
    var min = form.elements.price_min, max = form.elements.price_max;
    if (min && max && min.value && max.value && moneyNum(min.value) != null && moneyNum(max.value) != null && moneyNum(min.value) > moneyNum(max.value)) {
      bad(max, "Max price should be higher than min price.");
    }
    if (firstBad) {
      try { firstBad.focus({ preventScroll: true }); } catch (e) { firstBad.focus(); }
      fieldWrap(firstBad).scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function collect(form) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled || el.closest(".hp") || el.type === "submit" || el.type === "button") return;
      if (el.type === "checkbox") {
        if (el.name === "consent") { data.consent = el.checked; return; }
        if (!Array.isArray(data[el.name])) data[el.name] = [];
        if (el.checked) data[el.name].push(el.value);
        return;
      }
      if (el.type === "radio") { if (el.checked) data[el.name] = el.value; else if (!(el.name in data)) data[el.name] = ""; return; }
      var v = (el.value || "").trim();
      if (el.type === "tel" && v) v = formatPhone(v);
      data[el.name] = v;
    });
    if (data.consent) data.consent_text = CONSENT_TEXT;
    data.form_name = form.getAttribute("data-form");
    data.page_url = location.href;
    data.submitted_at = new Date().toISOString();
    data.source = "cledispo.com";
    return data;
  }

  function goThanks(name) { location.href = ROOT + "thank-you/?form=" + encodeURIComponent(name || ""); }

  function bind(form) {
    if (form._bound) return;
    form._bound = true;
    form.noValidate = true;
    form.querySelectorAll('input[type="tel"]').forEach(function (el) {
      el.addEventListener("blur", function () { if (el.value.trim()) el.value = formatPhone(el.value.trim()); });
    });
    form.addEventListener("input", function (e) { if (fieldWrap(e.target).classList.contains("has-error")) clearError(e.target); });
    form.addEventListener("change", function (e) { if (fieldWrap(e.target).classList.contains("has-error")) clearError(e.target); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".form-status");
      if (status) { status.textContent = ""; status.classList.remove("error"); }
      var name = form.getAttribute("data-form");
      var hp = form.querySelector('.hp input');
      if (hp && hp.value) { goThanks(name); return; } // bot: pretend success, send nothing
      if (!validate(form)) return;
      var payload = collect(form);
      var endpoint = (CFG.FORM_ENDPOINT || "").trim();
      if (!endpoint) {
        console.log("[cledispo form] FORM_ENDPOINT is empty — payload not sent:", payload);
        goThanks(name);
        return;
      }
      // One readable block of every field, used as the body of the notification email.
      payload.summary = Object.keys(payload).filter(function (k) { return k !== "summary"; }).map(function (k) {
        var v = payload[k];
        return k + ": " + (Array.isArray(v) ? v.join(", ") : (v == null ? "" : v));
      }).join("\n");
      var btn = form.querySelector('[type="submit"]');
      var label = btn ? btn.innerHTML : "";
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": CFG.FORM_SEND_AS_TEXT ? "text/plain;charset=utf-8" : "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok && r.type !== "opaque") throw new Error("HTTP " + r.status);
        goThanks(name);
      }).catch(function (err) {
        console.error("[cledispo form] send failed:", err);
        if (btn) { btn.disabled = false; btn.innerHTML = label; }
        if (status) {
          status.classList.add("error");
          status.innerHTML = "Sorry — that didn’t go through. Please try again, or call/text us at <a href=\"tel:" + (CFG.PHONE_E164 || "+12169303281") + "\">" + (CFG.PHONE_DISPLAY || "(216) 930-3281") + "</a>.";
        }
      });
    });
  }

  RPD.forms = { bind: bind, validUSPhone: validUSPhone, formatPhone: formatPhone, CONSENT_TEXT: CONSENT_TEXT };
  document.querySelectorAll("form[data-form]").forEach(bind);
})();

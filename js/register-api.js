/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/register-api.js
   Registration service (REQ 47 — POST /auth/register).

   Non-UI, programmatic account creation. Kept separate from the
   protected public lead form (index-v3.html) and the admin login
   so neither is modified by this flow. Any caller (a future
   login/signup popup, a settings page) can invoke:

       Sna3tiRegisterApi.create({ firstName, lastName, email, phone, password, cityId })
         .then(res => res.user)   // new account + stored JWT session
         .catch(err => err)       // { success:false, code, message, details }

   - Local validation before sending (server also validates).
   - Persists the JWT session on success via the shared ApiClient.
   - Normalizes errors (never exposes backend internals).
   Consumes the shared ApiClient + auth-api. Exposes `Sna3tiRegisterApi`.
   ============================================================ */

(function (global) {
  "use strict";

  var Api = global.Sna3tiApi || null;
  var AuthApi = global.Sna3tiAuthApi || null;

  // Local validation mirror (the server re-validates authoritatively).
  function validate(payload) {
    payload = payload || {};
    var errs = [];
    if (!payload.firstName) errs.push("Prénom requis.");
    if (!payload.lastName) errs.push("Nom requis.");
    if (!payload.phone) errs.push("Numéro de téléphone requis.");
    if (!payload.password || String(payload.password).length < 8) errs.push("Mot de passe trop court (≥ 8 caractères).");
    return errs;
  }

  function errorObject(code, message, details) {
    return { success: false, code: code || "BAD_REQUEST", message: message || "Inscription impossible.", details: details };
  }

  // Create an account. Optional password may be omitted and an email must
  // be provided to receive one — the server enforces the final rules.
  function create(payload) {
    if (!AuthApi) return Promise.reject(errorObject("UNSUPPORTED", "Le service d'inscription n'est pas disponible."));
    if (!Api) return Promise.reject(errorObject("UNSUPPORTED", "Le client API n'est pas disponible."));

    var errs = validate(payload);
    if (errs.length) return Promise.reject(errorObject("VALIDATION_ERROR", "Merci de corriger le formulaire.", errs));

    var body = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      password: payload.password
    };
    if (payload.email) body.email = payload.email;
    if (payload.cityId) body.cityId = payload.cityId;

    return AuthApi.register(body)
      .then(function (res) {
        // AuthApi.login-like: register may already persist tokens; ensure it.
        if (res && res.token) Api.setTokens(res.token, res.refreshToken || null);
        return { success: true, user: res && res.user ? res.user : null };
      })
      .catch(function (err) {
        // err is already normalized by the ApiClient: { success:false, code, message, details }
        if (err && err.success === false) return Promise.reject(err);
        return Promise.reject(errorObject("UNAUTHORIZED", "Inscription échouée. Réessayez."));
      });
  }

  global.Sna3tiRegisterApi = {
    create: create,
    validate: validate
  };

})(window);

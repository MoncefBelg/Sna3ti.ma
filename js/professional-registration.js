/* ============================================================
   Sna3ti.ma — Admin Web Platform
   js/professional-registration.js
   Professional registration + profile service (REQ 48).

   Orchestrates the public professional registration flow against
   the REST backend, without touching the protected lead form on
   index-v3.html (non-UI, programmatic API for any caller):

       User registration        POST /auth/register   -> JWT
       Professional profile     POST /professionals   -> created pro
       Retrieve created         GET  /professionals/:id
       Profile editing          PATCH /professionals/:id
       Profile deletion         DELETE /professionals/:id

   - Uses ONLY fields the backend schema + validators accept.
   - Backend validation is authoritative; local checks are cosmetic.
   - Authorized operations: a JWT is persisted after register so the
     subsequent /professionals calls carry `Authorization: Bearer`.
   - IDs are opaque strings (PRO-10001 ...) — never coerced to numbers.
   Consumes the shared ApiClient + auth-api + professionals-api.
   Exposes `Sna3tiProfReg`.
   ============================================================ */

(function (global) {
  "use strict";

  var Api = global.Sna3tiApi || null;
  var AuthApi = global.Sna3tiAuthApi || null;
  var ProsApi = global.Sna3tiProfessionalsApi || null;

  function errorObject(code, message, details) {
    return { success: false, code: code || "BAD_REQUEST", message: message || "Opération impossible.", details: details };
  }
  function requireApi() {
    if (!Api || !AuthApi || !ProsApi) {
      return { ok:false, err: errorObject("UNSUPPORTED", "Les modules API ne sont pas chargés.") };
    }
    return { ok:true };
  }

  // Local pre-flight for /auth/register (server re-validates).
  function validateAccount(account) {
    var errs = [];
    if (!account || !account.firstName) errs.push("Prénom requis.");
    if (!account || !account.lastName) errs.push("Nom requis.");
    if (!account || !account.phone) errs.push("Numéro de téléphone requis.");
    if (!account || !account.password || String(account.password).length < 8) errs.push("Mot de passe trop court (≥ 8 caractères).");
    return errs;
  }

  // Local pre-flight for /professionals (server re-validates: name + job).
  function validateProfile(profile) {
    var errs = [];
    if (!profile || !profile.name) errs.push("Nom de l'activité requis.");
    if (!profile || !profile.job) errs.push("Métier requis.");
    return errs;
  }

  function pickProfileFields(p) {
    p = p || {};
    var out = {};
    ["name","job","city","phone","email","description"].forEach(function(k){
      if (p[k] !== undefined && p[k] !== null && p[k] !== "") out[k] = p[k];
    });
    return out;
  }

  /**
   * Full public flow: create the user account, then the professional
   * profile, then retrieve the created professional.
   *   register({
   *     account: { firstName, lastName, email?, phone, password, cityId? },
   *     profile: { name, job, city?, phone?, email?, description? }
   *   }) -> { user, professional }
   */
  function register(input) {
    input = input || {};
    var guard = requireApi();
    if (!guard.ok) return Promise.reject(guard.err);

    var accountErrs = validateAccount(input.account);
    var profileErrs = validateProfile(input.profile);
    if (accountErrs.length || profileErrs.length) {
      return Promise.reject(errorObject("VALIDATION_ERROR", "Merci de corriger le formulaire.", accountErrs.concat(profileErrs)));
    }

    // Step 1 — create the user account and persist the session (JWT).
    return AuthApi.register({
      firstName: input.account.firstName,
      lastName: input.account.lastName,
      phone: input.account.phone,
      password: input.account.password,
      email: input.account.email || undefined,
      cityId: input.account.cityId || undefined
    })
      .then(function (reg) {
        if (reg && reg.token) Api.setTokens(reg.token, reg.refreshToken || null);

        // Step 2 — create the professional profile (Bearer attached by ApiClient).
        return ProsApi.create(pickProfileFields(input.profile)).then(function (created) {
          var pro = created && created.data ? created.data : created;

          // Step 3 — retrieve the created professional to confirm.
          if (pro && pro.id) {
            return ProsApi.get(pro.id).then(function (got) {
              var fresh = got && got.data ? got.data : got;
              return {
                success: true,
                user: reg && reg.user ? reg.user : null,
                professional: fresh || pro
              };
            }).catch(function (err) {
              // Creation succeeded but retrieve failed — still report the pro.
              return { success: true, user: reg.user || null, professional: pro, retrieved: false };
            });
          }
          return { success: true, user: reg.user || null, professional: pro || null };
        });
      })
      .catch(function (err) {
        if (err && err.success === false) return Promise.reject(err);
        return Promise.reject(errorObject("UNAUTHORIZED", "Inscription échouée. Réessayez."));
      });
  }

  /**
   * Edit a professional profile (only backend-accepted fields).
   *   update(profileId, { name?, job?, city?, phone?, email?, description?, package? })
   *   -> updated professional (requires a valid JWT)
   */
  function update(profileId, data) {
    var guard = requireApi();
    if (!guard.ok) return Promise.reject(guard.err);
    if (!profileId) return Promise.reject(errorObject("BAD_REQUEST", "Identifiant du professionnel requis."));

    var fields = pickProfileFields(data);
    if (data && data.package !== undefined) fields.package = data.package;

    return ProsApi.update(profileId, fields).then(function (res) {
      return { success: true, professional: res && res.data ? res.data : res };
    });
  }

  /**
   * Delete a professional profile (requires a valid JWT + authorization).
   *   remove(profileId) -> { id, deleted:true }
   */
  function remove(profileId) {
    var guard = requireApi();
    if (!guard.ok) return Promise.reject(guard.err);
    if (!profileId) return Promise.reject(errorObject("BAD_REQUEST", "Identifiant du professionnel requis."));

    return ProsApi.remove(profileId).then(function (res) {
      return { success: true, deleted: res && res.data ? res.data : res };
    });
  }

  global.Sna3tiProfReg = {
    register: register,
    update: update,
    remove: remove,
    validateAccount: validateAccount,
    validateProfile: validateProfile
  };

})(window);

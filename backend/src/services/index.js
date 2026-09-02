// Assembles the full services object from the injected repositories.

const authService = require("./authService");
const verificationService = require("./verificationService");
const paymentService = require("./paymentService");
const professionalService = require("./professionalService");
const subscriptionService = require("./subscriptionService");
const adminUserService = require("./adminUserService");
const notificationService = require("./notificationService");
const legalService = require("./legalService");
const searchService = require("./searchService");
const reviewService = require("./reviewService");
const reportService = require("./reportService");

function createServices(repos) {
  return {
    auth: {
      login: (body) => authService.login(repos, body),
      register: (body) => authService.register(repos, body),
      refresh: (body) => authService.refresh(repos, body),
      logout: () => authService.logout(),
      verifyToken: (token) => authService.verifyToken(token),
      getMe: (actor) => authService.getMe(repos, actor),
      getAdmin: (id) => authService.getAdmin(repos, id)
    },
    verification: {
      list: (query) => verificationService.list(repos, query),
      get: (id) => verificationService.get(repos, id),
      create: (data) => verificationService.create(repos, data),
      approve: (id, admin) => verificationService.approve(repos, id, admin),
      reject: (id, reason, admin) => verificationService.reject(repos, id, reason, admin),
      requestInfo: (id, note, admin) => verificationService.requestInfo(repos, id, note, admin)
    },
    payments: {
      list: (query) => repos.payments.findPending ? repos.payments.list({}) : [],
      get: (id) => paymentService.get(repos, id),
      create: (data, actor) => paymentService.create(repos, data, actor),
      confirm: (id, admin) => paymentService.confirm(repos, id, admin),
      reject: (id, reason, admin) => paymentService.reject(repos, id, reason, admin),
      requestInfo: (id, note, admin) => paymentService.requestInfo(repos, id, note, admin)
    },
    professionals: {
      list: (query) => professionalService.list(repos, query),
      get: (id) => repos.professionals.get(id),
      create: (data, actor) => professionalService.create(repos, data, actor),
      remove: (id, actor) => professionalService.remove(repos, id, actor),
      suspend: (id, admin, reason) => professionalService.suspend(repos, id, admin, reason),
      activate: (id, admin) => professionalService.activate(repos, id, admin),
      update: (id, data, admin) => professionalService.update(repos, id, data, admin)
    },
    search: {
      search: (query) => searchService.search(repos, query)
    },
    subscriptions: {
      list: (query) => subscriptionService.list(repos, query),
      get: (id) => subscriptionService.get(repos, id),
      create: (data, actor) => subscriptionService.create(repos, data, actor),
      update: (id, data, actor) => subscriptionService.update(repos, id, data, actor),
      cancel: (id, actor) => subscriptionService.cancel(repos, id, actor)
    },
    users: {
      list: () => repos.users.list(),
      get: (id) => repos.users.get(id)
    },
    adminUsers: {
      list: () => adminUserService.list(repos),
      create: (data) => adminUserService.create(repos, data),
      update: (id, data) => adminUserService.update(repos, id, data)
    },
    notifications: {
      list: (userId) => notificationService.list(repos, userId),
      markAllRead: (userId) => notificationService.markAllRead(repos, userId),
      markRead: (id, userId) => notificationService.markRead(repos, id, userId),
      create: (data) => notificationService.create(repos, data)
    },
    auditLogs: { list: () => repos.auditLogs.list({}, { orderBy: { createdAt: "desc" } }) },
    legal: {
      list: (query) => legalService.list(repos, query),
      getByTypeAndLanguage: (type, language, opts) => legalService.getByTypeAndLanguage(repos, type, language, opts),
      create: (data, admin) => legalService.create(repos, data, admin),
      update: (id, data, admin) => legalService.update(repos, id, data, admin)
    },
    reviews: {
      list: (professionalId, opts) => reviewService.list({ repos }, professionalId, opts),
      listAll: () => reviewService.listAll({ repos }),
      create: (professionalId, data, actor) => reviewService.create({ repos }, professionalId, data, actor),
      update: (reviewId, data, actor) => reviewService.update({ repos }, reviewId, data, actor),
      moderate: (reviewId, action, admin, reason) => reviewService.moderate({ repos }, reviewId, action, admin, reason)
    },
    reports: {
      create: (data, actor) => reportService.create({ repos }, data, actor),
      list: (query) => reportService.list({ repos }, query),
      resolve: (id, admin, note) => reportService.resolve({ repos }, id, admin, note),
      reject: (id, admin, note) => reportService.reject({ repos }, id, admin, note),
      warn: (id, admin, note) => reportService.warn({ repos }, id, admin, note),
      suspend: (id, admin, reason) => reportService.suspend({ repos }, id, admin, reason)
    },
    categories: {
      list: () => repos.categories.listActive(),
      get: (id) => repos.categories.get(id),
      create: (data) => repos.categories.create(data)
    },
    regions: { list: () => repos.regions.list({}, { orderBy: { order: "asc" } }) },
    plans: { list: () => repos.plans.list(), get: (id) => repos.plans.get(id) },
    support: { list: () => repos.support.list() }
  };
}

module.exports = { createServices };

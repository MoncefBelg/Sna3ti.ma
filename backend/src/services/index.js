// Assembles the full services object from the injected repositories.

const authService = require("./authService");
const verificationService = require("./verificationService");
const paymentService = require("./paymentService");
const professionalService = require("./professionalService");
const adminUserService = require("./adminUserService");
const notificationService = require("./notificationService");
const legalService = require("./legalService");

function createServices(repos) {
  return {
    auth: {
      login: (body) => authService.login(repos, body),
      verifyToken: (token) => authService.verifyToken(token),
      getMe: (adminId) => authService.getMe(repos, adminId)
    },
    verification: {
      approve: (id, admin) => verificationService.approve(repos, id, admin),
      reject: (id, reason, admin) => verificationService.reject(repos, id, reason, admin),
      requestInfo: (id, note, admin) => verificationService.requestInfo(repos, id, note, admin)
    },
    payments: {
      confirm: (id, admin) => paymentService.confirm(repos, id, admin),
      reject: (id, reason, admin) => paymentService.reject(repos, id, reason, admin),
      requestInfo: (id, note, admin) => paymentService.requestInfo(repos, id, note, admin)
    },
    professionals: {
      list: (query) => repos.professionals.search(query),
      get: (id) => repos.professionals.get(id),
      suspend: (id, admin, reason) => professionalService.suspend(repos, id, admin, reason),
      activate: (id, admin) => professionalService.activate(repos, id, admin),
      update: (id, data, admin) => professionalService.update(repos, id, data, admin)
    },
    users: {
      list: () => repos.users.list(),
      get: (id) => repos.users.get(id)
    },
    subscriptions: {
      list: () => repos.subscriptions.list()
    },
    adminUsers: {
      list: () => adminUserService.list(repos),
      create: (data) => adminUserService.create(repos, data),
      update: (id, data) => adminUserService.update(repos, id, data)
    },
    notifications: {
      list: (filter) => notificationService.list(repos, filter),
      markAllRead: () => notificationService.markAllRead(repos),
      markRead: (id) => notificationService.markRead(repos, id)
    },
    auditLogs: { list: () => repos.auditLogs.list({}, { orderBy: { timestamp: "desc" } }) },
    legal: { update: (id, data, admin) => legalService.update(repos, id, data, admin) },
    categories: {
      list: () => repos.categories.listActive(),
      get: (id) => repos.categories.get(id),
      create: (data) => repos.categories.create(data)
    },
    regions: { list: () => repos.regions.list({}, { orderBy: { order: "asc" } }) },
    plans: { list: () => repos.plans.list(), get: (id) => repos.plans.get(id) },
    reports: { list: () => repos.reports.list() },
    reviews: { list: () => repos.reviews.list() },
    support: { list: () => repos.support.list() }
  };
}

module.exports = { createServices };
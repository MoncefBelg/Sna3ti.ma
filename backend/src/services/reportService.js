// Report service (req 22). Users file reports against professionals; admins
// resolve, reject, warn, or suspend. Every admin action is audited (req 23).

const { AppError } = require("../utils/AppError");

const OPEN_STATUSES = ["new", "under_review"];

async function ensureProfessional(repos, id) {
  const pro = await repos.professionals.get(id);
  if (!pro) throw new AppError("Professionnel introuvable.", 404);
  return pro;
}

async function create(reqCtx, data, actor) {
  await ensureProfessional(reqCtx.repos, data.professionalId);
  const id = await reqCtx.repos.ids.nextId("report");
  const report = await reqCtx.repos.reports.create({
    id,
    professionalId: data.professionalId,
    reporter: (actor && actor.name) || "Utilisateur",
    reportedBy: (actor && actor.id) || null,
    reason: data.reason,
    type: data.type || null,
    description: data.description || null,
    status: "new",
    createdAt: new Date()
  });
  return report;
}

async function list(reqCtx, { status } = {}) {
  const rows = status ? await reqCtx.repos.reports.list({ status }, { orderBy: { createdAt: "desc" } })
    : await reqCtx.repos.reports.findOpen();
  return rows;
}

async function resolve(reqCtx, reportId, admin, note) {
  await setStatus(reqCtx.repos, reportId, "resolved", admin, "resolve", note);
  return reqCtx.repos.reports.get(reportId);
}

async function reject(reqCtx, reportId, admin, note) {
  await setStatus(reqCtx.repos, reportId, "ignored", admin, "reject", note);
  return reqCtx.repos.reports.get(reportId);
}

async function warn(reqCtx, reportId, admin, note) {
  const report = await setStatus(reqCtx.repos, reportId, "resolved", admin, "warn", note);
  await reqCtx.repos.professionals.update(report.professionalId, { warnReason: note || "Signalement" });
  return reqCtx.repos.reports.get(reportId);
}

async function suspend(reqCtx, reportId, admin, reason) {
  const report = await setStatus(reqCtx.repos, reportId, "resolved", admin, "suspend", reason);
  await reqCtx.repos.professionals.update(report.professionalId, { status: "suspended" });
  await reqCtx.repos.auditLogs.log({
    adminId: admin && admin.id, action: "PROFESSIONAL_SUSPENDED",
    entity: "Professional", entityId: report.professionalId, reason: reason || null
  });
  return reqCtx.repos.reports.get(reportId);
}

async function setStatus(repos, reportId, status, admin, action, note) {
  const report = await repos.reports.get(reportId);
  if (!report) throw new AppError("Signalement introuvable.", 404);
  await repos.reports.update(reportId, {
    status, warnReason: note || null, resolvedAt: new Date(), updatedAt: new Date()
  });
  const REPORT_ACTIONS = { resolve: "REPORT_RESOLVED", reject: "REPORT_REJECTED", warn: "REPORT_WARNED", suspend: "REPORT_SUSPENDED" };
  await repos.auditLogs.log({
    adminId: admin && admin.id, action: REPORT_ACTIONS[action] || `REPORT_${action.toUpperCase()}`,
    entity: "Report", entityId: reportId, reason: note || null
  });
  return report;
}

module.exports = { create, list, resolve, reject, warn, suspend, OPEN_STATUSES };

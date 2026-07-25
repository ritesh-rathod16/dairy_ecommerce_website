import adminClient from "../api/adminClient";
export { downloadBlob } from "../utils/download";

export const adminApi = {
  dashboard: () => adminClient.get("/admin/dashboard").then((r) => r.data),

  listCategories: () => adminClient.get("/admin/categories").then((r) => r.data),
  createCategory: (payload) => adminClient.post("/admin/categories", payload).then((r) => r.data),
  deleteCategory: (id) => adminClient.delete(`/admin/categories/${id}`),

  listProducts: () => adminClient.get("/admin/products").then((r) => r.data),
  createProduct: (payload) => adminClient.post("/admin/products", payload).then((r) => r.data),
  updateProduct: (id, payload) => adminClient.put(`/admin/products/${id}`, payload).then((r) => r.data),
  deleteProduct: (id) => adminClient.delete(`/admin/products/${id}`),
  uploadImage: (file) => {
    const form = new FormData();
    form.append("file", file);
    return adminClient.post("/admin/upload-image", form, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
  },

  listOrders: (status, search) =>
    adminClient.get("/admin/orders", { params: { ...(status ? { status } : {}), ...(search ? { search } : {}) } }).then((r) => r.data),
  updateOrderStatus: (id, status) => adminClient.patch(`/admin/orders/${id}/status`, { status }).then((r) => r.data),
  updatePaymentStatus: (id, payment_status) => adminClient.patch(`/admin/orders/${id}/payment-status`, { payment_status }).then((r) => r.data),
  assignOrder: (id, delivery_partner_id) => adminClient.patch(`/admin/orders/${id}/assign`, { delivery_partner_id }).then((r) => r.data),

  listDeliveryPartners: () => adminClient.get("/admin/delivery-partners").then((r) => r.data),
  createDeliveryPartner: (payload) => adminClient.post("/admin/delivery-partners", payload).then((r) => r.data),
  deleteDeliveryPartner: (id) => adminClient.delete(`/admin/delivery-partners/${id}`),
  updateDeliveryPartnerStatus: (id, status) => adminClient.patch(`/admin/delivery-partners/${id}/status`, { status }).then((r) => r.data),

  listEmployees: (role, search) =>
    adminClient.get("/admin/employees", { params: { ...(role ? { role } : {}), ...(search ? { search } : {}) } }).then((r) => r.data),
  createEmployee: (payload) => adminClient.post("/admin/employees", payload).then((r) => r.data),
  updateEmployee: (id, payload) => adminClient.put(`/admin/employees/${id}`, payload).then((r) => r.data),
  updateEmployeeStatus: (id, status) => adminClient.patch(`/admin/employees/${id}/status`, { status }).then((r) => r.data),
  deleteEmployee: (id) => adminClient.delete(`/admin/employees/${id}`),

  getSettings: () => adminClient.get("/admin/settings").then((r) => r.data),
  updateSettings: (payload) => adminClient.put("/admin/settings", payload).then((r) => r.data),

  getAnalytics: (dateFrom, dateTo, filters = {}) =>
    adminClient.get("/admin/analytics", { params: { date_from: dateFrom, date_to: dateTo, ...filters } }).then((r) => r.data),
  exportAnalyticsPdf: (dateFrom, dateTo, filters = {}) =>
    adminClient.get("/admin/analytics/export.pdf", { params: { date_from: dateFrom, date_to: dateTo, ...filters }, responseType: "blob" }).then((r) => r.data),
  exportAnalyticsExcel: (dateFrom, dateTo, filters = {}) =>
    adminClient.get("/admin/analytics/export.xlsx", { params: { date_from: dateFrom, date_to: dateTo, ...filters }, responseType: "blob" }).then((r) => r.data),

  exportCsv: (entity) => adminClient.get(`/admin/export/${entity}.csv`, { responseType: "blob" }).then((r) => r.data),
  downloadInvoice: (orderId) => adminClient.get(`/admin/orders/${orderId}/invoice`, { responseType: "blob" }).then((r) => r.data),

  dangerDelete: (target, confirm) => adminClient.post(`/admin/danger/${target}`, { confirm }).then((r) => r.data),
  dangerPreview: (target) => adminClient.get(`/admin/danger/preview/${target}`).then((r) => r.data),
};

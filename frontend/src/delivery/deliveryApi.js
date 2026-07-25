import deliveryClient from "../api/deliveryClient";

export const deliveryApi = {
  myOrders: () => deliveryClient.get("/delivery/my-orders").then((r) => r.data),
  getRoute: (orderId) => deliveryClient.get(`/delivery/orders/${orderId}/route`).then((r) => r.data),

  updateStage: (orderId, stage) => deliveryClient.patch(`/delivery/orders/${orderId}/stage`, { stage }).then((r) => r.data),
  reject: (orderId, reason) => deliveryClient.post(`/delivery/orders/${orderId}/reject`, { reason }).then((r) => r.data),

  sendLocation: (lat, lng) => deliveryClient.post("/delivery/location", { lat, lng }).then((r) => r.data),

  getQr: (orderId) => deliveryClient.get(`/delivery/orders/${orderId}/qr`, { responseType: "blob" }).then((r) => r.data),
  markPaid: (orderId, collectionMethod, transactionReference) =>
    deliveryClient.post(`/delivery/orders/${orderId}/mark-paid`, {
      collection_method: collectionMethod,
      transaction_reference: transactionReference || undefined,
    }).then((r) => r.data),

  getStats: () => deliveryClient.get("/delivery/stats").then((r) => r.data),
  getHistory: (dateFrom, dateTo, status) =>
    deliveryClient.get("/delivery/history", { params: { date_from: dateFrom, date_to: dateTo, status } }).then((r) => r.data),
};

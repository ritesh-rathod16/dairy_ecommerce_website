import { createAuthContext } from "../context/createAuthContext.jsx";
import deliveryClient from "../api/deliveryClient";

const { Provider, useAuthHook } = createAuthContext({
  tokenKey: "delivery_token",
  apiClient: deliveryClient,
});

export const DeliveryAuthProvider = Provider;
export const useDeliveryAuth = useAuthHook;

import { createAuthContext } from "../context/createAuthContext.jsx";
import adminClient from "../api/adminClient";

const { Provider, useAuthHook } = createAuthContext({
  tokenKey: "admin_token",
  apiClient: adminClient,
});

export const AdminAuthProvider = Provider;
export const useAdminAuth = useAuthHook;

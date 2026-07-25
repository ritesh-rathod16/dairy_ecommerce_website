import { createAuthContext } from "./createAuthContext.jsx";
import client from "../api/client";

const { Provider, useAuthHook } = createAuthContext({
  tokenKey: "kd_token",
  apiClient: client,
  supportsRegister: true,
});

export const AuthProvider = Provider;
export const useAuth = useAuthHook;

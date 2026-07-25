import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * Builds a self-contained { Provider, useAuthHook } pair backed by its own
 * localStorage token key and its own axios client. Used three times — once
 * each for the customer, admin, and delivery portals — so the three never
 * share session state, even across browser tabs on the same origin.
 */
export function createAuthContext({ tokenKey, apiClient, supportsRegister = false }) {
  const Ctx = createContext(null);

  function Provider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const token = localStorage.getItem(tokenKey);
      if (!token) {
        setLoading(false);
        return;
      }
      apiClient
        .get("/users/me")
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem(tokenKey))
        .finally(() => setLoading(false));
    }, []);

    const login = async (email, password) => {
      const res = await apiClient.post("/auth/login-json", { email, password });
      localStorage.setItem(tokenKey, res.data.access_token);
      setUser(res.data.user);
      return res.data.user;
    };

    const register = supportsRegister
      ? async (name, email, phone, password) => {
          const res = await apiClient.post("/auth/register", { name, email, phone, password });
          localStorage.setItem(tokenKey, res.data.access_token);
          setUser(res.data.user);
          return res.data.user;
        }
      : undefined;

    const logout = () => {
      localStorage.removeItem(tokenKey);
      setUser(null);
    };

    return (
      <Ctx.Provider value={{ user, setUser, loading, login, register, logout }}>
        {children}
      </Ctx.Provider>
    );
  }

  const useAuthHook = () => useContext(Ctx);
  return { Provider, useAuthHook };
}

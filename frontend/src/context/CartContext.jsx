import React, { createContext, useContext, useState, useCallback } from "react";
import client from "../api/client";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: 0, delivery_fee: 0, total: 0, free_delivery_limit: 299 });
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart({ items: [], subtotal: 0, delivery_fee: 0, total: 0, free_delivery_limit: 299 });
      return;
    }
    setLoading(true);
    try {
      const res = await client.get("/cart");
      setCart(res.data);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const addToCart = async (productId, quantity) => {
    const res = await client.post("/cart/items", { product_id: productId, quantity });
    setCart(res.data);
  };

  const removeFromCart = async (productId) => {
    const res = await client.delete(`/cart/items/${productId}`);
    setCart(res.data);
  };

  const clearCart = async () => {
    const res = await client.delete("/cart");
    setCart(res.data);
  };

  return (
    <CartContext.Provider value={{ cart, loading, refreshCart, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

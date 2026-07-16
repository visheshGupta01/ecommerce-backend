import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";

import {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from "../controllers/cart.controller.js";

const router = express.Router();

router.post("/items", authMiddleware, addToCart);

router.get("/", authMiddleware, getCart);

router.delete("/", authMiddleware, clearCart);

router.put("/items/:productId", authMiddleware, updateCartItem);

router.delete("/items/:productId", authMiddleware, removeCartItem);


export default router;

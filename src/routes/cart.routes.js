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

router.post("/add", authMiddleware, addToCart);

router.get("/", authMiddleware, getCart);

router.put("/update", authMiddleware, updateCartItem);

router.delete("/remove/:productId", authMiddleware, removeCartItem);

router.delete("/clear", authMiddleware, clearCart);

export default router;

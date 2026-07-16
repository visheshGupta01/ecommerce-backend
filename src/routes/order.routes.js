import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import { getAllOrders, getMyOrders, getOrderById, updateOrderStatus } from "../controllers/order.controller.js";
import adminMiddleware from "../middleware/admin.middleware.js";

const router = express.Router();


router.get("/", authMiddleware, adminMiddleware, getAllOrders);

router.put("/:id/status",  authMiddleware, adminMiddleware, updateOrderStatus);

router.get("/my", authMiddleware, getMyOrders);

router.get("/:id", authMiddleware, getOrderById);

export default router;

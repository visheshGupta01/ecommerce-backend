import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";
import {
  createShipment,
  schedulePickup,
  trackShipment,
  cancelShipment,
  calculateShipment,
} from "../controllers/shipment.controller.js";

const router = express.Router();

router.post(
  "/:orderId/create",
  authMiddleware,
  adminMiddleware,
  createShipment,
);

router.post(
  "/:orderId/pickup",
  authMiddleware,
  adminMiddleware,
  schedulePickup,
);

router.get("/:orderId/track", authMiddleware, trackShipment);

router.post(
  "/:orderId/cancel",
  authMiddleware,
  adminMiddleware,
  cancelShipment,
);

router.post("/calculate-shipment", authMiddleware, calculateShipment);


export default router;

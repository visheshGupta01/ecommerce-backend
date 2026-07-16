import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";
import { getDashboard } from "../controllers/admin.controller.js";

const router = express.Router();

router.get("/dashboard", authMiddleware, adminMiddleware, getDashboard);

export default router;

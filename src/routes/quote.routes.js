import express from "express";
import { createQuoteRequest, getAllQuotes, updateQuoteStatus } from "../controllers/quote.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createQuoteRequest);
router.get("/", authMiddleware, adminMiddleware, getAllQuotes);
router.patch("/:id/status", authMiddleware, adminMiddleware, updateQuoteStatus);

export default router;

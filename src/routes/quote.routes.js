import express from "express";
import { createQuoteRequest, getAllQuotes, getMyQuotes, updateQuoteStatus } from "../controllers/quote.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createQuoteRequest);
router.get("/", authMiddleware, adminMiddleware, getAllQuotes);
router.patch("/:id/status", authMiddleware, adminMiddleware, updateQuoteStatus);
router.get("/my-quotes", authMiddleware, getMyQuotes);

export default router;

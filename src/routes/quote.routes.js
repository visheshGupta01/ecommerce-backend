import express from "express";
import { createQuoteRequest } from "../controllers/quote.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, createQuoteRequest);

export default router;

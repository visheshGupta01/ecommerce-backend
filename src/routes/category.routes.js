import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";

import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";

const router = express.Router();

router.get("/", getAllCategories);
router.get("/:id", getCategoryById);

router.post("/", authMiddleware, adminMiddleware, createCategory);

router.put("/:id", authMiddleware, adminMiddleware, updateCategory);

router.delete("/:id", authMiddleware, adminMiddleware, deleteCategory);

export default router;

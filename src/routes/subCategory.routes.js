import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";

import {
  createSubCategory,
  getAllSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
} from "../controllers/subCategory.controller.js";

const router = express.Router();

router.get("/", getAllSubCategories);
router.get("/:id", getSubCategoryById);

router.post("/", authMiddleware, adminMiddleware, createSubCategory);

router.put("/:id", authMiddleware, adminMiddleware, updateSubCategory);

router.delete("/:id", authMiddleware, adminMiddleware, deleteSubCategory);

export default router;

import express from "express";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  getProductFilters
} from "../controllers/product.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";
import upload from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/", getAllProducts);
router.get("/filters", getProductFilters);  
router.get("/:id", getProductById);
router.post("/", authMiddleware, adminMiddleware, upload.array("images"), createProduct);
router.put("/:id", authMiddleware, adminMiddleware,upload.array("images"), updateProduct);
router.delete("/:id", authMiddleware, adminMiddleware, deleteProduct);

export default router;

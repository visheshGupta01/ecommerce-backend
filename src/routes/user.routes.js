import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";
import {
  getAllUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser,
} from "../controllers/user.controller.js";

const router = express.Router();

// Admin only
router.get("/", authMiddleware, adminMiddleware, getAllUsers);
router.get("/:id", authMiddleware, adminMiddleware, getUserById);
router.put("/:id", authMiddleware, adminMiddleware, updateUser);
router.patch("/:id/status", authMiddleware, adminMiddleware, updateUserStatus);
router.delete("/:id", authMiddleware, adminMiddleware, deleteUser);

export default router;

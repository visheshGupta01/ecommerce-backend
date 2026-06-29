import express from "express";
import { getMe, loginUser, registerUser } from "../controllers/auth.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Auth Route Working",
  });
});

router.post("/register", registerUser);
router.post("/login", loginUser)
router.get("/me", authMiddleware, getMe)

export default router;

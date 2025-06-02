import express from "express";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/dashboard", protect, (req, res) => {
  if (req.user.role !== "customer") {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json({ message: "Customer dashboard loaded", user: req.user });
});

export default router;

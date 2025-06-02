import express from "express";
import {
  createService,
  getServices,
  getServiceById,
} from "../controllers/serviceController.js";

import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public
router.get("/", getServices);
router.get("/:id", getServiceById);

// Protected (servians only)
router.post("/", protect, createService);

export default router;

import express from "express";
import { registerUser, loginUser } from "../controllers/authController.js";
import upload from "../middlewares/uploadMiddleware.js";
import { sendOtpToPhone, verifyOtpForPhone } from "../controllers/sendOTPToPhone.js";
import { sendOtpToEmail, verifyOtpForEmail } from "../controllers/sendOtpEmail.js";

const router = express.Router();

router.post(
    '/register',
    upload.fields([
      { name: 'profileImage', maxCount: 1 },
      { name: 'cnicFront', maxCount: 1 },
      { name: 'cnicBack', maxCount: 1 },
    ]),
    registerUser
  );
router.post("/login", loginUser);
// router.post("/send-otp", sendOtpToPhone);
// router.post("/verify-otp", verifyOtpForPhone);

router.post("/send-otp-email", sendOtpToEmail);
router.post("/verify-otp-email", verifyOtpForEmail);

export default router;

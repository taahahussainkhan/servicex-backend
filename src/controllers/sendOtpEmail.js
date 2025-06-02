
import User from "../models/User.js";
import sendOtpEmail from "../utils/sendEmail.js";

export const sendOtpToEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await sendOtpEmail(email, otp);

    await User.updateOne(
      { email },
      {
        email,
        otp,
        otpExpires: Date.now() + 10 * 60 * 1000,
      },
      { upsert: true }
    );

    res.status(200).json({ message: "OTP sent successfully to email" });
  } catch (error) {
    console.error("Email send failed:", error);
    res.status(500).json({ message: "Failed to send OTP email" });
  }
};

export const verifyOtpForEmail = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Use updateOne instead of save() to avoid validation issues
    await User.updateOne(
      { email },
      {
        $set: { isEmailVerified: true },
        $unset: { otp: 1, otpExpires: 1 }
      }
    );

    res.status(200).json({ message: "Email verified successfully" });
  } catch (error) {
    console.error("OTP verification failed:", error);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
};
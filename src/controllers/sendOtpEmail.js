import OTPVerification from "../models/OTPVerification.js"; 
import sendOtpEmail from "../utils/sendEmail.js";

export const sendOtpToEmail = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    await sendOtpEmail(email, otp);

    
    await OTPVerification.updateOne(
      { email },
      {
        email,
        otp,
        otpExpires: Date.now() + 10 * 60 * 1000, 
        isEmailVerified: false
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
    
    const otpRecord = await OTPVerification.findOne({ email });
    if (!otpRecord) return res.status(404).json({ message: "OTP not found" });

    if (otpRecord.otp !== otp || otpRecord.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    
    await OTPVerification.updateOne(
      { email },
      {
        $set: { isEmailVerified: true },
        $unset: { otp: 1, otpExpires: 1 }
      }
    );

    res.status(200).json({ 
      message: "Email verified successfully", 
      success: true 
    });
  } catch (error) {
    console.error("OTP verification failed:", error);
    res.status(500).json({ message: "Failed to verify OTP" });
  }
};


export const isEmailVerified = async (email) => {
  try {
    const otpRecord = await OTPVerification.findOne({ 
      email, 
      isEmailVerified: true 
    });
    return !!otpRecord;
  } catch (error) {
    return false;
  }
};
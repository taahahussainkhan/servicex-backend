// sendOtpController.js
import User from "../models/User.js";
import sendOtpSms from "../utils/sendSms.js";

export const sendOtpToPhone = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone is required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await sendOtpSms(phone, otp); 


  await User.updateOne(
    { phone },
    {
      phone,
      otp,
      otpExpires: Date.now() + 10 * 60 * 1000,
    },
    { upsert: true }
  );

  res.status(200).json({ message: "OTP sent successfully" });
};


export const verifyOtpForPhone = async (req, res) => {
    const { phone, otp } = req.body;
  
    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ message: "User not found" });
  
    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
  
    user.isPhoneVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
  
    res.status(200).json({ message: "Phone number verified" });
  };
  
import User from "../models/User.js";
import Customer from "../models/Customer.js";
import Servian from "../models/Servian.js";
import generateToken from "../utils/generateToken.js";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";
import OTPVerification from "../models/OTPVerification.js"; // Add this import

export const registerUser = async (req, res) => {
  try {
    console.log("📥 Body:", req.body);
    console.log("🖼️ Files:", req.files);

    const { name, email, password, role, phone } = req.body;

    console.log("Incoming body:", req.body);
    console.log("Incoming files:", req.files);

    if (!name || !email || !password || !role || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 🔥 ADD EMAIL VERIFICATION CHECK HERE
    console.log("🔍 Checking email verification for:", email);
    const otpRecord = await OTPVerification.findOne({ 
      email: email.trim().toLowerCase(), 
      isEmailVerified: true 
    });

    if (!otpRecord) {
      console.log("❌ Email not verified for:", email);
      return res.status(400).json({ 
        message: "Email must be verified before registration. Please verify your email first." 
      });
    }
    console.log("✅ Email verification confirmed for:", email);

    if (
      !req.files ||
      !req.files.profileImage ||
      !req.files.cnicFront ||
      !req.files.cnicBack
    ) {
      return res.status(400).json({ message: "All images are required" });
    }

    const profileImgUrl = req.files.profileImage[0].path;
    const cnicFrontUrl = req.files.cnicFront[0].path;
    const cnicBackUrl = req.files.cnicBack[0].path;

    const userExists = await User.findOne({ email: email.toLowerCase() }) ||
      await Customer.findOne({ email: email.toLowerCase() }) ||
      await Servian.findOne({ email: email.toLowerCase() });

    if (userExists) {
      if (userExists.isVerified) {
        return res.status(400).json({ message: "Account already exists and is verified. Please login." });
      } else {
        // Delete the unverified account and allow re-registration
        console.log("🗑️ Deleting unverified account to allow re-registration");
        
        // Delete from the appropriate collection
        if (userExists.role === 'customer') {
          await Customer.findByIdAndDelete(userExists._id);
        } else if (userExists.role === 'servian') {
          await Servian.findByIdAndDelete(userExists._id);
        } else {
          await User.findByIdAndDelete(userExists._id);
        }
        
        console.log("✅ Unverified account deleted, proceeding with new registration");
      }
    }

    let userData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
      phone: phone.trim(),
      profileImage: profileImgUrl,
      cnicFront: cnicFrontUrl,
      cnicBack: cnicBackUrl,
      isEmailVerified: true, // Set this to true since we verified it
    };

    let user;
    if (role === "customer") {
      const { address } = req.body; // Optional field for customers
      user = await Customer.create({
        ...userData,
        address: address ? address.trim() : undefined
      });
    } else if (role === "servian") {
      const { experienceYears, skills } = req.body; // Required fields for servians
      if (!experienceYears || !skills) {
        return res.status(400).json({
          message: "Experience years and skills are required for servian role"
        });
      }
      user = await Servian.create({
        ...userData,
        experienceYears: parseInt(experienceYears),
        skills: Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim())
      });
    } else {
      user = await User.create(userData);
    }

    // 🧹 Clean up OTP record after successful registration
    console.log("🧹 Cleaning up OTP record for:", email);
    await OTPVerification.deleteOne({ email: email.trim().toLowerCase() });
    console.log("✅ OTP record cleaned up");

    res.status(201).json({
      message: "Registration successful! Your account is under verification.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified || false
      },
      token: generateToken(user._id),
    });

  } catch (error) {
    console.error("❌ Registration error:", JSON.stringify(error, null, 2));

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: "Validation failed",
        errors: errors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Email already exists"
      });
    }

    res.status(500).json({
      message: error.message || "Server Error"
    });
  }
};
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    console.log("🔍 Looking for user with email:", email.toLowerCase());

    let user = null;
    let userType = null;

    // Try to find user in each collection with password field
    const userBase = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (userBase) {
      user = userBase;
      userType = 'User';
    }

    if (!user) {
      const customerUser = await Customer.findOne({ email: email.toLowerCase() }).select('+password');
      if (customerUser) {
        user = customerUser;
        userType = 'Customer';
      }
    }

    if (!user) {
      const servianUser = await Servian.findOne({ email: email.toLowerCase() }).select('+password');
      if (servianUser) {
        user = servianUser;
        userType = 'Servian';
      }
    }

    console.log("🧑 Found user:", user ? {
      id: user._id,
      email: user.email,
      type: userType,
      role: user.role || user.__t,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0
    } : "No user found");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.password) {
      console.log("❌ User password is still undefined! Trying alternative method...");

      // Alternative: Use aggregation to get password
      const models = [User, Customer, Servian];
      for (let Model of models) {
        const result = await Model.aggregate([
          { $match: { email: email.toLowerCase() } },
          { $project: { _id: 1, email: 1, password: 1, name: 1, role: 1, __t: 1, isVerified: 1 } }
        ]);

        if (result.length > 0) {
          user = result[0];
          console.log("🔄 Found user via aggregation:", {
            id: user._id,
            email: user.email,
            hasPassword: !!user.password,
            passwordLength: user.password ? user.password.length : 0
          });
          break;
        }
      }
    }

    if (!user.password) {
      console.log("❌ Still no password found!");
      return res.status(500).json({ message: "Server error - password data missing" });
    }

    console.log("🔐 Attempting password validation...");

    // Check password using bcrypt directly
    const bcrypt = await import('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.password);

    console.log("✅ Password validation result:", isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Get user data without password for response
    const userResponse =
      (await User.findOne({ email: email.toLowerCase() })) ||
      (await Customer.findOne({ email: email.toLowerCase() })) ||
      (await Servian.findOne({ email: email.toLowerCase() }));

    console.log("Sending user data:", {
      _id: userResponse._id,
      name: userResponse.name,
      email: userResponse.email,
      role: userResponse.role || userResponse.__t,
      token: generateToken(userResponse),
      isVerified: userResponse.isVerified,
    });

    res.json({
      _id: userResponse._id,
      name: userResponse.name,
      email: userResponse.email,
      role: userResponse.role || userResponse.__t,
      token: generateToken(userResponse),
      isVerified: userResponse.isVerified,
    });

    console.log("🧍 Logged in user type:", userType);

  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export const cleanupUnverifiedAccounts = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find and delete unverified accounts
    const deletedUser = await User.findOneAndDelete({
      email: email.toLowerCase(),
      isVerified: false
    });

    const deletedCustomer = await Customer.findOneAndDelete({
      email: email.toLowerCase(),
      isVerified: false
    });

    const deletedServian = await Servian.findOneAndDelete({
      email: email.toLowerCase(),
      isVerified: false
    });

    const deletedCount = (deletedUser ? 1 : 0) + (deletedCustomer ? 1 : 0) + (deletedServian ? 1 : 0);

    if (deletedCount > 0) {
      res.json({
        message: `Cleaned up ${deletedCount} unverified account(s) for ${email}`,
        success: true
      });
    } else {
      res.json({
        message: "No unverified accounts found for this email",
        success: false
      });
    }

  } catch (error) {
    console.error("❌ Cleanup error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
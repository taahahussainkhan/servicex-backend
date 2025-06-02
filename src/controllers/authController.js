import User from "../models/User.js";
import Customer from "../models/Customer.js"; 
import Servian from "../models/Servian.js";   
import generateToken from "../utils/generateToken.js";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";

export const registerUser = async (req, res) => {
  try {
    console.log("📥 Body:", req.body);
    console.log("🖼️ Files:", req.files);

    const { name, email, password, role, phone } = req.body;

    console.log("Incoming body:", req.body);
    console.log("Incoming files:", req.files);

    // Validate required fields
    if (!name || !email || !password || !role || !phone) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate required files
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

    // Check if user already exists
    const userExists = await User.findOne({ email }) || 
                      await Customer.findOne({ email }) || 
                      await Servian.findOne({ email });
                      
    if (userExists) {
      if (userExists.isVerified) {
        return res.status(400).json({ message: "Account already exists and is verified. Please login." });
      } else {
        return res.status(400).json({ message: "Your account is already under verification. Please wait up to 24 hours." });
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

    // Step 1: Get the document normally (not lean yet) so you can call .matchPassword()
    let user =
      await User.findOne({ email: email.toLowerCase() }) ||
      await Customer.findOne({ email: email.toLowerCase() }) ||
      await Servian.findOne({ email: email.toLowerCase() });

    if (user && (await user.matchPassword(password))) {
      // Step 2: Now get the lean version (with virtuals) for token generation
      const userLean =
        (await User.findOne({ email: email.toLowerCase() }).lean({ virtuals: true })) ||
        (await Customer.findOne({ email: email.toLowerCase() }).lean({ virtuals: true })) ||
        (await Servian.findOne({ email: email.toLowerCase() }).lean({ virtuals: true }));

      console.log("Sending user data:", {
        _id: userLean._id,
        name: userLean.name,
        email: userLean.email,
        role: userLean.role,
        token: generateToken(userLean),
        isVerified: userLean.isVerified,
      });

      res.json({
        _id: userLean._id,
        name: userLean.name,
        email: userLean.email,
        role: userLean.role,
        token: generateToken(userLean),
        isVerified: userLean.isVerified,
      });

      console.log("🧍 Logged in user:", user.constructor.modelName);

    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
const User = require("../models/user.models");
const bcrypt = require("bcryptjs");

const signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    return res.status(201).json({ message: "User created successfully" });
  } catch (e) {
    console.error("Error during signup:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const comparePassword = await bcrypt.compare(password, user.password);
    if (!comparePassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.status(200).json({ message: "Login successful" });
  } catch (e) {
    console.error("Error during login:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const forgetPassword = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    await user.save();
    return res.status(200).json({ message: "OTP sent successfully", otp });
  } catch (e) {
    console.error("Error during forget password:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const resetPassword = async (req, res) => {
  const { otp, newPassword } = req.body;
  try {
    if (!otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const user = await User.findOne({ otp });
    if (!user) {
      return res.status(404).json({ message: "Invalid OTP" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = null;
    await user.save();
    return res.status(200).json({ message: "Password reset successful" });
  } catch (e) {
    console.error("Error during reset password:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { signup, login, forgetPassword, resetPassword };

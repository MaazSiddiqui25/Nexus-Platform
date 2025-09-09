import bcrypt from "bcryptjs";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

// ✅ Get Profile (protected)
export const getProfile = async (req, res) => {
  res.json(req.user);
};

// ✅ Update Profile (protected)
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name || user.name;
    user.bio = req.body.bio || user.bio;
    user.avatarUrl = req.body.avatarUrl || user.avatarUrl;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate a JWT reset token (expires in 15 minutes)
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    // For testing, we return the token in JSON
    res.json({
      message: "Password reset token (for testing)",
      resetToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(400).json({ message: "Invalid or expired token" });
  }
};

// REGISTER
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({ name, email, password: hashedPassword, role });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// LOGIN - Updated with role validation
export const loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body; // ✅ Now accepting role from request

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ Check if selected role matches registered role
    if (role && user.role !== role) {
      const correctRole = user.role === 'investor' ? 'Investor' : 'Entrepreneur';
      const selectedRole = role === 'investor' ? 'Investor' : 'Entrepreneur';
      
      return res.status(400).json({ 
        message: `You are registered as ${correctRole}. Please select the ${correctRole} option to login.`,
        registeredRole: user.role
      });
    }

    // ✅ Successful login
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

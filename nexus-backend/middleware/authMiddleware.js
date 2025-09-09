import jwt from "jsonwebtoken";
import User from "../models/User.js";


// ✅ Protect middleware - authenticate user
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res.status(401).json({ message: "User not found" });
      }

      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

// ✅ Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

// ✅ Verified user (for payments)
export const requireVerification = async (req, res, next) => {
  try {
    const Wallet = (await import("../models/Wallet.js")).default;

    const wallet = await Wallet.findOne({ userId: req.user._id });

    if (!wallet || !wallet.isVerified) {
      return res.status(403).json({
        message: "Account verification required. Please complete KYC verification.",
        requiresVerification: true
      });
    }

    next();
  } catch (error) {
    console.error("Verification middleware error:", error);
    res.status(500).json({ message: "Server error during verification check" });
  }
};

// ✅ Rate limiting (simple in-memory)
export const rateLimit = (windowMs = 15 * 60 * 1000, max = 5) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = `${req.user._id}-${req.route.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (requests.has(key)) {
      const userRequests = requests.get(key);
      const validRequests = userRequests.filter((time) => time > windowStart);
      requests.set(key, validRequests);
    }

    const userRequests = requests.get(key) || [];

    if (userRequests.length >= max) {
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
      });
    }

    userRequests.push(now);
    requests.set(key, userRequests);

    next();
  };
};

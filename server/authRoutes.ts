import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { storage } from "./storage";
import { z } from "zod";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";

const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const verifySchema = z.object({
  code: z.string().length(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

router.post("/signup", async (req, res) => {
  try {
    const validation = signupSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }

    const { email, password, fullName, phone } = validation.data;
    const normalizedEmail = email.toLowerCase();

    const existingUser = await storage.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const user = await storage.createUser({
      email: normalizedEmail,
      passwordHash,
      fullName,
      phone,
      verificationCode,
      verificationExpiresAt,
    });

    // Send verification email
    try {
      await sendVerificationEmail(normalizedEmail, verificationCode);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      // Continue with signup even if email fails - user can resend later
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.status(500).json({ error: "Failed to create session" });
      }
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }
        res.json({ ok: true });
      });
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }

    const { email, password } = validation.data;
    const normalizedEmail = email.toLowerCase();

    const user = await storage.getUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error("Session regeneration error:", err);
        return res.status(500).json({ error: "Failed to create session" });
      }
      (req.session as any).userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ error: "Failed to save session" });
        }
        res.json({ ok: true, isVerified: user.isVerified });
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Failed to log out" });
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.json({ user: null });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.json({ user: null });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        isVerified: user.isVerified,
        profileImageUrl: user.profileImageUrl,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const validation = verifySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid verification code format" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.verificationCode !== validation.data.code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    if (!user.verificationExpiresAt || new Date() > user.verificationExpiresAt) {
      return res.status(400).json({ error: "Verification code has expired" });
    }

    await storage.updateUserProfile(userId, {
      isVerified: true,
      verificationCode: null,
      verificationExpiresAt: null,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Verify error:", error);
    res.status(500).json({ error: "Failed to verify account" });
  }
});

router.post("/resend-code", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: "Account already verified" });
    }

    const verificationCode = generateVerificationCode();
    const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await storage.updateUserProfile(userId, {
      verificationCode,
      verificationExpiresAt,
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationCode);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return res.status(500).json({ error: "Failed to send verification email" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Resend code error:", error);
    res.status(500).json({ error: "Failed to resend code" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const validation = forgotPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid email" });
    }

    const normalizedEmail = validation.data.email.toLowerCase();
    const user = await storage.getUserByEmail(normalizedEmail);

    if (user) {
      const resetToken = generateResetToken();
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.updateUserResetToken(user.id, resetToken, resetTokenExpiresAt);

      const host = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "localhost:5000";
      const protocol = host.includes("localhost") ? "http" : "https";
      const resetUrl = `${protocol}://${host}/reset-password?token=${resetToken}`;
      
      // Send password reset email
      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (emailError) {
        console.error("Failed to send password reset email:", emailError);
        // Don't reveal whether the email exists for security
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.get("/validate-reset-token", async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.json({ valid: false });
    }

    const user = await storage.getUserByResetToken(token);
    if (!user) {
      return res.json({ valid: false });
    }

    if (!user.resetTokenExpiresAt || new Date() > user.resetTokenExpiresAt) {
      return res.json({ valid: false });
    }

    res.json({ valid: true });
  } catch (error) {
    console.error("Validate reset token error:", error);
    res.json({ valid: false });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }

    const { token, newPassword } = validation.data;

    const user = await storage.getUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    if (!user.resetTokenExpiresAt || new Date() > user.resetTokenExpiresAt) {
      return res.status(400).json({ error: "Reset token has expired" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await storage.updateUserPassword(user.id, passwordHash);

    res.json({ ok: true });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.get("/has-password", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ hasPassword: !!user.passwordHash });
  } catch (error) {
    console.error("Has password error:", error);
    res.status(500).json({ error: "Failed to check password status" });
  }
});

router.post("/set-password", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.passwordHash) {
      return res.status(400).json({ error: "Password already set. Use change-password instead." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await storage.updateUserPassword(userId, passwordHash);

    res.json({ ok: true });
  } catch (error) {
    console.error("Set password error:", error);
    res.status(500).json({ error: "Failed to set password" });
  }
});

router.post("/change-password", async (req, res) => {
  try {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const validation = changePasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors[0].message });
    }

    const { currentPassword, newPassword } = validation.data;

    const user = await storage.getUser(userId);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "User not found or no password set" });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await storage.updateUserPassword(userId, passwordHash);

    res.json({ ok: true });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;

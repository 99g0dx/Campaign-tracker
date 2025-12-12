import { Router } from "express";
import { storage } from "./storage";
import crypto from "crypto";
import { z } from "zod";
import { sendVerificationEmail } from "./email";

const router = Router();

const startVerificationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(6, "Phone number is required"),
});

const verifyCodeSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

router.post("/start", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const parsed = startVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { firstName, lastName, email, phone } = parsed.data;

    const code = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    const user = await storage.updateUserProfile(userId, {
      firstName,
      lastName,
      email,
      phone,
      verificationCode: code,
      verificationExpiresAt: expires,
      isVerified: false,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await sendVerificationEmail(email, code);

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Error starting verification:", error);
    if (error.message === 'Email is already in use by another account') {
      return res.status(409).json({ error: "This email is already registered to another account. Please use a different email." });
    }
    res.status(500).json({ error: "Failed to start verification" });
  }
});

router.post("/verify", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const parsed = verifyCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    const { code } = parsed.data;

    const user = await storage.getUser(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (
      !user.verificationCode ||
      user.verificationCode !== code ||
      !user.verificationExpiresAt ||
      user.verificationExpiresAt < new Date()
    ) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    await storage.updateUserProfile(userId, {
      isVerified: true,
      verificationCode: null,
      verificationExpiresAt: null,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error("Error verifying code:", error);
    res.status(500).json({ error: "Failed to verify code" });
  }
});

router.post("/resend", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(userId);
    if (!user || !user.email) {
      return res.status(404).json({ error: "User not found or email missing" });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await storage.updateUserProfile(userId, {
      verificationCode: code,
      verificationExpiresAt: expires,
    });

    await sendVerificationEmail(user.email, code);

    res.json({ ok: true });
  } catch (error) {
    console.error("Error resending code:", error);
    res.status(500).json({ error: "Failed to resend code" });
  }
});

export default router;

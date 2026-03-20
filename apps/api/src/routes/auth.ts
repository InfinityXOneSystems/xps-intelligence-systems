import { Router } from "express";
import jwt from "jsonwebtoken";
import { getSupabase } from "../lib/supabase.js";
import { getDb } from "../lib/db.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return res.status(401).json({ error: error?.message || "Invalid credentials" });
    }

    // Fetch role from users table
    const db = getDb();
    const result = await db.query(
      "SELECT id, email, role, location_id FROM users WHERE supabase_uid = $1",
      [data.user.id]
    );

    const user = result.rows[0] as { id: string; email: string; role: string; location_id: string } | undefined;
    if (!user) {
      return res.status(404).json({ error: "User not found in system" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, location_id: user.location_id },
      secret,
      { expiresIn: "8h" }
    );

    return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.json({ status: "ok" });
});

authRouter.post("/register", async (req, res) => {
  try {
    const { email, password, full_name } = req.body as { email?: string; password?: string; full_name?: string };
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const supabase = getSupabase();
    const db = getDb();

    // Check if user already exists
    const existing = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: "Email already registered" });

    // Create in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) return res.status(400).json({ error: error?.message || "Registration failed" });

    // Create in users table with role = sales_staff
    const result = await db.query(
      `INSERT INTO users (supabase_uid, email, full_name, role, onboarding_complete, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, role`,
      [data.user.id, email, full_name || email.split("@")[0], "sales_staff", false, JSON.stringify({ onboarding_complete: false })]
    );

    const user = result.rows[0] as { id: string; email: string; role: string };
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn: "8h" });

    res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

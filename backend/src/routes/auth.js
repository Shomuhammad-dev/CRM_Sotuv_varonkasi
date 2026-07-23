import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { safeRedis } from "../redis.js";

const router = Router();

// Barcha 7 operator bitta "operator" loginini ishlatgani uchun urinishlar
// hisoblagichi ham ular orasida umumiy — past chegara qo'ysak, bitta xato
// urinish butun jamoani vaqtincha bloklab qo'yishi mumkin. Shu sabab chegara
// avtomatlashtirilgan hujumni sekinlashtirish uchun yetarli, lekin tasodifiy
// xato terishlar butun operatorlar jamoasini bloklab qo'ymasligi uchun
// nisbatan yuqori qilib tanlangan.
const RATE_MAX = Number(process.env.LOGIN_RATE_LIMIT_MAX || 10);
const RATE_WINDOW_SEC = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_SEC || 60);

// Operatorlarning barchasi login="operator" ni ishlatadi — parol orqali
// qaysi operator ekanligi aniqlanadi, shu sabab username bo'yicha bir nechta
// qator qaytishi mumkin va har biriga navbat bilan parol tekshiriladi. Bu
// bitta umumiy login uchun 7 xil parolni tasodifiy sinash xavfini kuchaytiradi,
// shu sabab bir xil IP+login juftligi uchun urinishlar Redis orqali cheklanadi.
router.post("/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Login va parolni kiriting" });
  }

  const rateKey = `login_fail:${req.ip}:${username}`;
  const attempts = Number((await safeRedis.get(rateKey)) || 0);
  if (attempts >= RATE_MAX) {
    const ttl = await safeRedis.ttl(rateKey);
    const wait = ttl > 0 ? `${Math.ceil(ttl / 60)} daqiqadan so'ng` : "birozdan so'ng";
    return res.status(429).json({ error: `Juda ko'p urinish. ${wait} qayta urinib ko'ring` });
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);

  let matched = null;
  for (const u of rows) {
    if (await bcrypt.compare(password, u.password_hash)) {
      matched = u;
      break;
    }
  }

  if (!matched) {
    await safeRedis.incrWithExpire(rateKey, RATE_WINDOW_SEC);
    return res.status(401).json({ error: "Login yoki parol xato" });
  }

  await safeRedis.del(rateKey);

  const payload = {
    id: matched.id,
    role: matched.role,
    operatorNumber: matched.operator_number,
    username: matched.username,
    displayName: matched.display_name,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  res.json({ token, user: payload });
}));

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;

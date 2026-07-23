import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  enableOfflineQueue: false, // Redis o'chiq bo'lsa buyruqlar darhol xato qaytaradi (cheksiz kutmaydi)
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 500, 5000), // fonda qayta ulanishga urinaveradi
});

let warned = false;
redis.on("error", (err) => {
  if (!warned) {
    console.warn("⚠ Redis ulanmadi — kesh va login limiti vaqtincha o'chirilgan:", err.message);
    warned = true;
  }
});
redis.on("ready", () => {
  if (warned) console.log("✔ Redis qayta ulandi");
  warned = false;
});

// Redis ixtiyoriy infratuzilma: u ishlamasa ham marshrutlar (login, lidlar)
// buzilmasligi kerak — shu sabab har bir chaqiruv xatoni yutib, null/no-op qaytaradi.
export const safeRedis = {
  async get(key) {
    try {
      return await redis.get(key);
    } catch {
      return null;
    }
  },
  async set(key, value, ttlSeconds) {
    try {
      if (ttlSeconds) await redis.set(key, value, "EX", ttlSeconds);
      else await redis.set(key, value);
    } catch {
      // jim o'tkazib yuboriladi
    }
  },
  async del(...keys) {
    try {
      if (keys.length) await redis.del(...keys);
    } catch {
      // jim o'tkazib yuboriladi
    }
  },
  async incrWithExpire(key, ttlSeconds) {
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, ttlSeconds);
      return count;
    } catch {
      return null;
    }
  },
  async ttl(key) {
    try {
      return await redis.ttl(key);
    } catch {
      return -2;
    }
  },

  // Lidlar ro'yxati keshi uchun: yozilgan har bir kesh kaliti shu to'plamga
  // qo'shiladi, shunda yozish (create/update/import/distribute...) bo'lganda
  // qancha turli filtr bo'yicha kesh borligini bilmasdan hammasini tozalash mumkin.
  async cacheSet(key, value, ttlSeconds, setName) {
    try {
      await redis.set(key, value, "EX", ttlSeconds);
      await redis.sadd(setName, key);
    } catch {
      // jim o'tkazib yuboriladi
    }
  },
  async invalidateCacheSet(setName) {
    try {
      const keys = await redis.smembers(setName);
      if (keys.length) await redis.del(...keys, setName);
      else await redis.del(setName);
    } catch {
      // jim o'tkazib yuboriladi
    }
  },
};

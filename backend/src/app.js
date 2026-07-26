import express from "express";
import cors from "cors";
import compression from "compression";
import authRoutes from "./routes/auth.js";
import leadsRoutes from "./routes/leads.js";
import leadCommentsRoutes from "./routes/leadComments.js";
import remindersRoutes from "./routes/reminders.js";
import distributionRoutes from "./routes/distribution.js";
import operatorsRoutes from "./routes/operators.js";

const app = express();

app.use(cors());
app.use(compression()); // lidlar soni minglab bo'lganda JSON javobni siqib, tarmoq orqali tezroq yuboradi
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/leads", leadCommentsRoutes);
app.use("/api/reminders", remindersRoutes);
app.use("/api/distribute", distributionRoutes);
app.use("/api/operators", operatorsRoutes);

app.use((req, res) => res.status(404).json({ error: "Topilmadi" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server xatosi" });
});

export default app;

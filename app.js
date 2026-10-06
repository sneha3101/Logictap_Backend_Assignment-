const express = require("express");
const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    // unique index: the database itself refuses a second record for the same call_id,
    // even if two identical requests arrive at the same moment.
    call_id: { type: String, required: true, unique: true, trim: true },
    status: { type: String },
    duration_secs: { type: Number, min: 0 },
  },
  { timestamps: { createdAt: "received_at", updatedAt: false }, versionKey: false }
);
const Call = mongoose.models.Call || mongoose.model("Call", callSchema);

const app = express();
app.use(express.json());

// Bad JSON syntax -> clear 400 instead of a crash/HTML error page
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  next(err);
});

app.post("/call-ended", async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Request body must be a JSON object" });
  }

  const { call_id, status, duration_secs } = body;
  if (typeof call_id !== "string" || call_id.trim() === "") {
    return res.status(400).json({ error: "call_id is required and must be a non-empty string" });
  }
  if (status !== undefined && typeof status !== "string") {
    return res.status(400).json({ error: "status must be a string" });
  }
  if (
    duration_secs !== undefined &&
    (!Number.isInteger(duration_secs) || duration_secs < 0)
  ) {
    return res.status(400).json({ error: "duration_secs must be a non-negative integer" });
  }

  const id = call_id.trim();
  try {
    // Insert only if missing. With new:false the result is the OLD document,
    // so null means "nothing existed, we just inserted".
    const existing = await Call.findOneAndUpdate(
      { call_id: id },
      { $setOnInsert: { call_id: id, status, duration_secs } },
      { upsert: true, new: false }
    );
    const created = existing === null;
    return res.status(created ? 201 : 200).json({ ok: true, call_id: id, duplicate: !created });
  } catch (err) {
    // Two identical requests racing each other: the loser hits the unique index.
    if (err.code === 11000) {
      return res.status(200).json({ ok: true, call_id: id, duplicate: true });
    }
    console.error(err);
    return res.status(500).json({ error: "internal server error" });
  }
});

app.get("/calls/:callId", async (req, res) => {
  try {
    const call = await Call.findOne({ call_id: req.params.callId }).lean();
    if (!call) return res.status(404).json({ error: "call not found" });
    const { _id, ...record } = call;
    return res.json(record);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal server error" });
  }
});

module.exports = { app, Call };

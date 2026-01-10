// controllers/cldMinimalController.js
import axios from "axios";
import crypto from "crypto";
import connection from "../config/connectDB.js";

const CLD_BASE_URL = process.env.CLD_BASE_URL;
const CLD_CLIENT_USERNAME = process.env.CLD_CLIENT_USERNAME;
const CLD_CALLBACK_SECRET = process.env.CLD_CALLBACK_SECRET || "";

// helper
const num = (x, d=0) => (Number.isFinite(Number(x)) ? Number(x) : d);

// GET /cld/game_link?game_id=...
// controllers/cldMinimalController.js (patch just this part)

export const getGameLink = async (req, res) => {
  try {
    const token = req.cookies?.auth;
    const gameId = req.query?.game_id;
    if (!token) return res.status(400).json({ message: "Login required" });
    if (!gameId) return res.status(400).json({ message: "game_id is required" });

    const [rows] = await connection.execute(
      "SELECT phone, money, status FROM users WHERE token=? AND veri=1 LIMIT 1",
      [token]
    );
    const user = rows?.[0];
    if (!user || user.status !== 1) return res.status(401).json({ message: "Unauthorized" });

    const payload = {
      client_username: CLD_CLIENT_USERNAME,
      member_account: user.phone,
      game_uid: gameId,
      credit_amount: Number(user.money) || 0,
      currency_code: "INR",
    };

    const { data } = await axios.post(
      `${CLD_BASE_URL}/api/seamless/launch`,
      payload,
      { headers: { "Content-Type": "application/json" }, timeout: 10000 }
    );

    // Accept the provider's different shapes
    const launchUrl =
      data?.payload?.game_launch_url ||       // <-- your provider's actual shape
      data?.data?.launch_url ||
      data?.launch_url ||
      data?.game_url ||
      data?.data?.game_launch_url ||
      data?.payload?.launch_url;

    if ((data?.code === 0 || data?.msg === "Success") && launchUrl) {
      return res.redirect(launchUrl);
    }

    // Fallback: if we still didn't detect it, bubble full details for debugging
    return res.status(502).json({ message: "Failed to generate game link", detail: data });
  } catch (e) {
    console.error(e?.response?.data || e);
    return res.status(500).json({ message: "Failed to get game link" });
  }
};


// POST /provider/callback/cld
// ENV: CLD_CALLBACK_SECRET (optional, for HMAC verification)

export const providerCallback = async (req, res) => {
  const toNum = (n, d = 0) => {
    const v = Number(n);
    return Number.isFinite(v) ? v : d;
  };

  try {
    // Optional HMAC check if provider sends "X-Signature: sha256=<hex>"
    const sig = req.headers["x-signature"];
    if (CLD_CALLBACK_SECRET && typeof sig === "string" && sig.startsWith("sha256=") && req.rawBody) {
      const expected = crypto.createHmac("sha256", CLD_CALLBACK_SECRET).update(req.rawBody).digest("hex");
      const got = sig.slice("sha256=".length).trim();
      if (expected !== got) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const {
      serial_number,
      member_account,          // your player identifier (we map to users.phone)
      game_uid,
      currency_code,
      bet_amount = 0,
      win_amount = 0,
      net_amount,              // if present, authoritative delta (+/-)
      timestamp,
      data: extraData,
    } = req.body || {};

    // Required fields
    for (const k of ["serial_number", "member_account", "game_uid", "currency_code"]) {
      if (!req.body || req.body[k] === undefined || req.body[k] === null || req.body[k] === "") {
        return res.status(400).json({ error: `Missing field: ${k}` });
      }
    }

    // Fetch player by member_account
    const [uRows] = await connection.execute(
      "SELECT id, phone, money, status FROM users WHERE phone=? AND veri=1 LIMIT 1",
      [member_account]
    );
    const user = uRows?.[0];
    if (!user || user.status !== 1) {
      return res.status(404).json({ error: "Unknown or inactive player" });
    }

    let balance = toNum(user.money, 0);

    // Idempotency: save event once using UNIQUE(serial_number)
    const [ins] = await connection.execute(
      `INSERT IGNORE INTO game_events
       (serial_number, member_account, game_uid, bet_amount, win_amount, currency_code, event_ts, raw, processed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        String(serial_number),
        member_account,
        String(game_uid),
        toNum(bet_amount, 0),
        toNum(win_amount, 0),
        String(currency_code),
        toNum(timestamp || Date.now()),
        JSON.stringify(extraData || null),
      ]
    );

    if (ins.affectedRows > 0) {
      // First time processing this serial_number → apply delta
      const delta = (net_amount !== undefined && net_amount !== null)
        ? toNum(net_amount, 0)
        : (toNum(win_amount, 0) - toNum(bet_amount, 0)); // +win, -bet

      const next = balance + delta;
      const finalBalance = next < 0 ? 0 : next; // avoid negative balances

      await connection.execute(
        "UPDATE users SET money=?, total_money=? WHERE id=?",
        [finalBalance, finalBalance, user.id]
      );
      balance = finalBalance;
    } else {
      // Duplicate callback → don’t reapply; return current stored balance
      const [[fresh]] = await connection.query(
        "SELECT money FROM users WHERE id=? LIMIT 1",
        [user.id]
      );
      balance = toNum(fresh?.money, balance);
    }

    // ✅ Respond exactly as provider expects
    return res.json({ balance: Number(balance) });
  } catch (err) {
    console.error("providerCallback error:", err?.response?.data || err);
    return res.status(500).json({ error: "Callback processing failed" });
  }
};

// keep an object export if you prefer that style
const cldMinimalController = { getGameLink, providerCallback };
export default cldMinimalController;

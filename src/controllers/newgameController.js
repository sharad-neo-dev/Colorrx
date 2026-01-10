import pool from "../config/connectDB.js";
import fs from "fs";
import path from "path";
import axios from "axios";

const NEXX_API_URL = "https://apis.nexxapi.tech/api/auth.php";
const PARTNER_KEY = "422c9433b80eea2a1fe3512ea12d212ce3e54b7cd7f9cfc80e64a9c7f05a655f";

// === Log directory ===
// const logDir = path.join(__dirname, '../logs');
// if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

/**
 * Get user data from auth token (cookie)
 */
const getUserDataByAuthToken = async (authToken) => {
  const [users] = await pool.query(
    "SELECT id_user, money, name_user FROM users WHERE token = ?",
    [authToken]
  );
  const user = users?.[0];
  if (!user) throw new Error("Unable to get user data!");
  return {
    id: user.id_user,
    money: parseFloat(user.money || 0),
    name: user.name_user,
  };
};

/**
 * -------------------------------
 * GAME LAUNCH HANDLER
 * -------------------------------
 */
const launch = async (req, res, providerCode, gameCode, currency) => {
  try {
    const auth = req.cookies?.auth;
    if (!auth) {
      return res.status(401).json({ success: false, error: "User not logged in" });
    }

    const user = await getUserDataByAuthToken(auth);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const payload = {
      partnerKey: PARTNER_KEY,
      game: {
        gameCode: gameCode === 'null' ? "" : gameCode,
        providerCode: providerCode === 'null' ? "" : providerCode,
        platform: "mobile",
      },
      timestamp: Math.floor(Date.now() / 1000).toString(),
      user: {
        id: user.id.toString(),
        currency: currency,
        displayName: user.name,
        backUrl: "https://ace11.in/",
      },
    };

    const response = await axios.post(NEXX_API_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });

    const data = response.data;

    if (data.status?.code === "SUCCESS" && data.launchURL) {
      // ✅ Return JSON response instead of redirect
      return res.status(200).json({
        success: true,
        launchURL: data.launchURL,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: data.status?.message || "Game cannot be launched.",
      });
    }
  } catch (error) {
    console.error(`Error launching game (${providerCode}, ${gameCode}):`, error.message);
    return res.status(500).json({
      success: false,
      error: "Something went wrong. Try again later.",
    });
  }
};



// Express route handler
export const launchers = (req, res) => {
  const { providerCode, gameCode,currency } = req.query;
  return launch(req, res, providerCode, gameCode,currency);
};


// -------------------------------
// Helper: Update User Balance
// -------------------------------
const updateUserBalance = async (userId, amount, type = "debit") => {
  const [userRows] = await pool.query(
    "SELECT money FROM users WHERE id_user = ?",
    [userId]
  );
  if (userRows.length === 0) throw new Error("User not found");

  const currentBalance = parseFloat(userRows[0].money || 0);
  const newBalance = type === "credit" ? currentBalance + amount : currentBalance - amount;

  await pool.query("UPDATE users SET money = ? WHERE id_user = ?", [newBalance, userId]);
  return newBalance;
};

// -------------------------------
// Helper: Verify Partner Key
// -------------------------------
const verifyPartnerKey = (key) => key === PARTNER_KEY;

// -------------------------------
// WEBHOOK: Debit
// -------------------------------
// export const nexxDebit = async (req, res) => {
//   try {
//     const { partnerKey, user, gameData, transactionData } = req.body;
    
    
    
    
//       const logDir = path.join(process.cwd(), "logs");
//     if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

//     const now = new Date();
//     const logFile = path.join(logDir, `top_notify_${now.toISOString().slice(0, 10)}.log`);
//     const logEntry = {
//       time: now.toISOString(),
//       ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
//       body: data,
//     };
//     fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");

//     // Partner key check (optional)
//     // if (!verifyPartnerKey(partnerKey))
//     //   return res.status(401).json({ status: { code: "ERROR", message: "Invalid partner key" } });

//     const userId = user?.id;
//     const amount = parseFloat(transactionData?.amount || gameData?.transactionData?.amount || 0);

//     if (!userId || isNaN(amount) || amount <= 0) 
//       return res.status(400).json({ error: "Invalid userId or amount" });

//     const balance = await updateUserBalance(userId, amount, "debit");

//     res.json({
//       partnerKey,
//       timestamp: Date.now().toString(),
//       userId,
//       balance,
//       status: { code: "SUCCESS", message: "" }
//     });
//   } catch (error) {
//     console.error("Debit webhook error:", error.message);
//     res.status(500).json({ status: { code: "ERROR", message: error.message } });
//   }
// };


// // -------------------------------
// // WEBHOOK: Credit
// // -------------------------------
// export const nexxCredit = async (req, res) => {
//   try {
//     const { partnerKey, user, transactionData } = req.body;
//     // if (!verifyPartnerKey(partnerKey))
//     //   return res.status(401).json({ status: { code: "ERROR", message: "Invalid partner key" } });
    
    
//       const logDir = path.join(process.cwd(), "logs");
//     if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

//     const now = new Date();
//     const logFile = path.join(logDir, `top_notify_${now.toISOString().slice(0, 10)}.log`);
//     const logEntry = {
//       time: now.toISOString(),
//       ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
//       body: data,
//     };
//     fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");

//     const userId = user?.id;
//     const amount = parseFloat(transactionData?.amount || 0);
//     if (!userId || isNaN(amount)) 
//         return res.status(400).json({ error: "Invalid userId or amount" });

//     const balance = await updateUserBalance(userId, amount, "credit");

//     res.json({
//       partnerKey,
//       timestamp: Date.now().toString(),
//       userId,
//       balance,
//       status: { code: "SUCCESS", message: "" }
//     });
//   } catch (error) {
//     console.error("Credit webhook error:", error.message);
//     res.status(500).json({ status: { code: "ERROR", message: error.message } });
//   }
// };



// ✅ Helper for IP
const getClientIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0] ||
  req.connection?.remoteAddress ||
  req.socket?.remoteAddress ||
  req.ip;

// ✅ Helper: unified logging (incoming + outgoing)
const writeLog = (type, req, responseData) => {
  try {
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const now = new Date();
    const logFile = path.join(logDir, `${type}_${now.toISOString().slice(0, 10)}.log`);

    const logEntry = {
      time: now.toISOString(),
      ip: getClientIp(req),
      body: req.body, // ✅ incoming data
      response: responseData, // ✅ outgoing response
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");
  } catch (err) {
    console.error("Failed to write log:", err.message);
  }
};

// -------------------------------
// WEBHOOK: Debit
// -------------------------------
export const nexxDebit = async (req, res) => {
  try {
    const { partnerKey, user, gameData, transactionData } = req.body;

    // ✅ Logging setup
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const now = new Date();
    const logFile = path.join(logDir, `nexxDebit_${now.toISOString().slice(0, 10)}.log`);
    const logEntry = {
      time: now.toISOString(),
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      body: req.body, // ✅ fixed: previously "data" was undefined
    };
    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");

    // Optional partner key validation
    // if (!verifyPartnerKey(partnerKey))
    //   return res.status(401).json({ status: { code: "ERROR", message: "Invalid partner key" } });

    const userId = user?.id;
    const amount = parseFloat(transactionData?.amount || gameData?.transactionData?.amount || 0);

    if (!userId || isNaN(amount)) {
      const errorRes = { error: "Invalid userId or amount" };
      writeLog("nexxDebit", req, errorRes);
      return res.status(400).json(errorRes);
    }

    let balance = null;

    // ✅ FIXED: update only when amount > 0, otherwise just get balance
    if (amount > 0) {
      // ✅ Update balance (subtract for debit)
      balance = await updateUserBalance(userId, amount, "debit");
    } else {
      // ✅ Just fetch current balance (no update)
      const [rows] = await pool.query("SELECT money FROM users WHERE id_user = ?", [userId]);
      balance = rows.length > 0 ? parseFloat(rows[0].money) : 0;
    }

    const successRes = {
      partnerKey,
      timestamp: Date.now().toString(),
      userId,
      balance,
      status: { code: "SUCCESS", message: "" },
    };

    writeLog("nexxDebit", req, successRes);
    res.json(successRes);
  } catch (error) {
    console.error("Debit webhook error:", error.message);
    const errorRes = { status: { code: "ERROR", message: error.message } };
    writeLog("nexxDebit", req, errorRes);
    res.status(500).json(errorRes);
  }
};

// -------------------------------
// WEBHOOK: Credit
// -------------------------------
export const nexxCredit = async (req, res) => {
  try {
    const { partnerKey, user, transactionData } = req.body;

    // ✅ Logging setup
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const now = new Date();
    const logFile = path.join(logDir, `nexxCredit_${now.toISOString().slice(0, 10)}.log`);
    const logEntry = {
      time: now.toISOString(),
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      body: req.body, // ✅ fixed
    };
    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");

    // Optional partner key check
    // if (!verifyPartnerKey(partnerKey))
    //   return res.status(401).json({ status: { code: "ERROR", message: "Invalid partner key" } });

    const userId = user?.id;
    const amount = parseFloat(transactionData?.amount || 0);

    if (!userId || isNaN(amount)) {
      const errorRes = { error: "Invalid userId or amount" };
      writeLog("nexxCredit", req, errorRes);
      return res.status(400).json(errorRes);
    }

    let balance = null;

    // ✅ FIXED: update only when amount > 0, otherwise just get balance
    if (amount > 0) {
      // ✅ Update balance (add for credit)
      balance = await updateUserBalance(userId, amount, "credit");
    } else {
      // ✅ Just fetch current balance (no update)
      const [rows] = await pool.query("SELECT money FROM users WHERE id_user = ?", [userId]);
      balance = rows.length > 0 ? parseFloat(rows[0].money) : 0;
    }

    const successRes = {
      partnerKey,
      timestamp: Date.now().toString(),
      userId,
      balance,
      status: { code: "SUCCESS", message: "" },
    };

    writeLog("nexxCredit", req, successRes);
    res.json(successRes);
  } catch (error) {
    console.error("Credit webhook error:", error.message);
    const errorRes = { status: { code: "ERROR", message: error.message } };
    writeLog("nexxCredit", req, errorRes);
    res.status(500).json(errorRes);
  }
};

// -------------------------------
// WEBHOOK: Balance
// -------------------------------
export const nexxBalance = async (req, res) => {
  try {
    const { partnerKey, userId } = req.body;

    // Optional: verify partner key
    // if (partnerKey !== PARTNER_KEY) {
    //   return res.status(401).json({ status: { code: "ERROR", message: "Invalid partner key" } });
    // }

    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const now = new Date();
    const logFile = path.join(logDir, `nexxBalance_${now.toISOString().slice(0, 10)}.log`);
    const logEntry = {
      time: now.toISOString(),
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      body: req.body, // ✅ fixed: previously "data" was undefined
    };
    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");

    if (!userId) {
      const errorRes = { status: { code: "ERROR", message: "Missing userId" } };
      writeLog("nexxBalance", req, errorRes);
      return res.status(400).json(errorRes);
    }

    // Fetch user balance from database
    const [rows] = await pool.query("SELECT money FROM users WHERE id_user = ?", [userId]);
    const balance = rows.length > 0 ? parseFloat(rows[0].money) : 0;

    // Respond with the expected format
    const successRes = {
      partnerKey: partnerKey || "",
      timestamp: Date.now().toString(),
      userId,
      balance,
      status: { code: "SUCCESS", message: "" },
    };

    writeLog("nexxBalance", req, successRes);
    res.json(successRes);
  } catch (error) {
    console.error("Balance webhook error:", error.message);
    const errorRes = {
      status: { code: "ERROR", message: "Server error: " + error.message },
    };
    writeLog("nexxBalance", req, errorRes);
    res.status(500).json(errorRes);
  }
};

// -------------------------------
// Default export (all functions)
// -------------------------------
const newgameController = {
  launchers,
  nexxBalance,
  nexxCredit,
  nexxDebit
};

export default newgameController;

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';
import multer from 'multer';
import querystring from 'querystring';
import { TopPaySignUtil } from "./TopPaySignUtil.js";

import moment from "moment";
import pool from '../config/connectDB.js';
import connection from '../config/connectDB.js';
import { fileURLToPath } from 'url';
import { generateClaimRewardID, getBonuses } from "../helpers/games.js";
import AppError from "../errors/AppError.js";
import {
  REWARD_STATUS_TYPES_MAP,
  REWARD_TYPES_MAP,
} from "../constants/reward_types.js";


// === Paths setup ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Upload directory ===
const uploadDir = path.join("src", "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// === Multer storage configuration ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Optional: file filter & size limit
export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images are allowed"), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});



export const PaymentStatusMap = {
  PENDING: 0,
  SUCCESS: 1,
  CANCELLED: 2,
};

const PaymentMethodsMap = {
  USDT_MANUAL: "usdt_manual",
}






// === Log directory ===
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

// === Constants ===
const APP_ID = "634006322551066624";
const SECRET_KEY = "634006322291019776";

// === Utility: Generate unique order number ===
const generateOrderNumber = () => `ORD${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;

// === Get user data from token ===
const getUserDataByAuthToken = async (authToken) => {
  const [users] = await pool.query(
    "SELECT `phone`, `code`, `name_user`, `invite` FROM users WHERE `token` = ?",
    [authToken]
  );
  const user = users?.[0];
  if (!user) throw new Error("Unable to get user data!");
  return {
    phone: user.phone,
    code: user.code,
    username: user.name_user,
    invite: user.invite,
  };
};



const getUserDataByPhoneNumber = async (phoneNumber) => {
  let [users] = await connection.query(
    "SELECT `phone`, `code`,`name_user`,`invite` FROM users WHERE `phone` = ? ",
    [phoneNumber],
  );
  const user = users?.[0];

  if (user === undefined || user === null) {
    throw Error("Unable to get user data!");
  }

  return {
    phone: user.phone,
    code: user.code,
    username: user.name_user,
    invite: user.invite,
  };
};






export const lg_pay = async (req, res) => {
    
    
   const APP_ID =  process.env.lg_pay_APP_ID;
   const SECRET_KEY = process.env.lg_pay_SECRET_KEY;
   const TRADE_TYPE = "INRUPI"; // Use 'test' for sandbox mode
  try {
    const auth = req.cookies?.auth;
    const user = await getUserDataByAuthToken(auth);

    const { amount } = req.body;
    if (!amount || amount < 50) {
      return res.status(400).json({ error: "Amount must be at least 50" });
    }

    const order_sn = generateOrderNumber();

    // Save pending recharge to DB
    const newRecharge = {
      orderId: order_sn,
      transactionId: null,
      utr: null,
      phone: user.phone,
      money: amount,
      type: "lg_pay",
      status: 0, // pending
      today: rechargeTable.getCurrentTimeForTodayField(),
      time: rechargeTable.getCurrentTimeForTimeField(),
      url: null,
    };

    await rechargeTable.create(newRecharge);

    // --- Prepare API Request ---
    const params = {
      app_id: APP_ID,
      trade_type: TRADE_TYPE,
      order_sn,
      money: Math.floor(amount * 100), // multiply by 100 and remove decimals
      notify_url: "https://ace11.in/api/webapi/payment/lg/notify",
      ip: req.ip || "0.0.0.0",
      remark: user.phone || "no-phone",
    };

    // Generate signature (MD5 of sorted params + key)
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys.map(k => `${k}=${params[k]}`).join("&");
    const signString = `${queryString}&key=${SECRET_KEY}`;
    const sign = crypto.createHash("md5").update(signString, "utf8").digest("hex").toUpperCase();

    const finalParams = { ...params, sign };

    // --- Send request to LG Pay ---
    const response = await axios.post(
      "https://www.lg-pay.com/api/order/create",
      querystring.stringify(finalParams),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10000 }
    );

    // --- Return to frontend ---
    return res.json({
      success: true,
      order_sn,
      data: response.data,
    });
  } catch (error) {
    console.error("LG Pay Error:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response ? error.response.data : error.message,
    });
  }
};






export const webpay = async (req, res) => {
  const MCH_ID = "S820251025125903000005";
  const MCH_PRIVATE_KEY = `
-----BEGIN RSA PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCBbdB0nDXOafoC
rl3ezlvuuXHDkcLR4541bTKqLI/M9Nng7XF7wOcCZPsutv7VWpTaX35SeOFOGEy1
H8zZv7V5w5Djx++06MJEtPjn6ss1yumRQWuRJcF7p+kUf1PxW7ATZnhioqx84V6p
tcb+zTRbrWrnZ5vjr6IBQtKn7afs0ZlWu5Rbkh3YWccX/1cVPIb3TjKPYkRPEL2X
cEaBS4EEE8OR7rlKvQkTjeA8z7rXZ/lJw3dYqPzE9mjW9p/5PyetCFtT/B6PZGof
LxD73H4cwGxIdWHuOEExWXt7jwRrb/R5avHuSElmfTUUdmET4Rn90dINsrZgkgzf
KNJ8UNAJAgMBAAECggEAEig/uDw56C1B36JqlNlKWGE3roICXMOb7E7Xbrw1qEEp
V763zu6u+c0E1/bgJTpB66i95gADS5tpF3fQmzOj1+MxrmLcI/sLVew1hwOPYoqG
3dPZrVEopZpWvoNmWVPNjcswVFYR8KsFRrWzpwdOsxXPC4ujePuotJiVSO20Qyqn
2T7G/NySON6aUZT9BGZgY//sSufhRrA+rNvpw2AE+hp0SjIu+/eW3mDKx9Qr3v6n
XgFlf7nXAnasjpGIW1MreNgLX0T47T5+iDhdxaleZJK/mZ6WWldGbsU5KYSgzJt6
8iD5840ze7MAqgqVm+EvVAkfihvpY+546n9OUuzIAQKBgQDnHcitfQUnrMKhgaE6
kfqD6sA/Twz1ehU+YxN+UcI/rD0idhtg86Zub1BUs4cXlql6g5pzd1CU8/ZrFqsU
DttftVGRTyat3jvvVkkaXjEEfZbLJMxyWPGv18d1AkuGjPgNt8cREx1M0Mgi4sH5
2afXalfQ4bjPgm7TFiO9gW0igQKBgQCPXT2EltYM6CDxWK8fF2f4Lec18Wr3N9fD
OaLuoWzYJOY2Dqt+tJLEIWHEGTZE1BTNY0q4cmBneUylVsNOheKeCKgjFXmauxY4
VBgxz9579lbJudi3pWFG1mC+K1x8qkfMibsnZhQgJQk0zadFPpnYkSAGF//RmV27
ESFZTarZiQKBgAFKa0p8vkCgeF3KiYn4Mrv13aj82ges7N1yVDOKZVlRru24VyLN
eYp4WKyAbCq3jq6+eWhXrD2It0GV2NK92n/IVXJITOD/srn9c18QU5nA0czEodep
o3/l5plCsAVKWEBLXHM99hXtvJBlT8wDaSqMz3y9JfkSs2e+Yei3BlMBAoGBAInT
TNoUHLKJ02nTJYCRgv3AO6DLeFc1U3O3DGG3xSlCyCM+FTcZqGNv6EqbJmYjMeCG
zYXnR7ESl1H4yIjMBCKEFgisk5zisajzh9MTkUPBfowu5B8hmhR88sLAcwjSt3X3
D3sAEucYU/J0p5PVbBgc5RmWpvS9KbQ28sWk+lRpAoGBANidTigf+ji/UB3m3oPS
ihGuWa2pBv7/Yz/ISgD4N+wF/DUeEkQuqIQ9o6OM+qpCHOqxnUpR8Dv1NMtlJI83
K2APrez82LexQoRIO/+6gMgPwgVstAFG9leDk4eR3sTjZR18DFjRtjOrZvg7vyJW
2BQELchTihJCpOouvbDs8LZx
-----END RSA PRIVATE KEY-----`;

  const REQ_URL = "https://india-openapi.toppay.asia/pay/newOrder";

  try {
    const auth = req.cookies?.auth;
    const user = await getUserDataByAuthToken(auth);
    const { amount } = req.body;

    if (!amount || amount < 50) {
      return res.status(400).json({ success: false, error: "Amount must be at least 50" });
    }

    // ✅ Generate a unique order number
    const orderNumber = generateOrderNumber();
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // ✅ Build request parameters
    const requestParams = {
      merchantCode: MCH_ID,
      orderNum: orderNumber,
      orderAmount: amount.toFixed(2),
      callback: "https://ace11.in/api/webapi/payment/top/notify",
      timestamp,
    };

    // ✅ Create recharge record before sending request
    const newRecharge = {
      orderId: orderNumber,
      transactionId: null,
      utr: null,
      phone: user.phone,
      money: amount,
      type: "top_pay",
      status: 0, // pending
      today: rechargeTable.getCurrentTimeForTodayField(),
      url: null,
      time: rechargeTable.getCurrentTimeForTimeField(),
    };

    const recharge = await rechargeTable.create(newRecharge);

    // ✅ Sign the request
    const source = TopPaySignUtil.paramFormat(requestParams);
    const sign = TopPaySignUtil.sign(MCH_PRIVATE_KEY, source);
    requestParams.sign = sign;

    // ✅ Send request to TopPay
    const responseJson = await TopPaySignUtil.doPost(REQ_URL, JSON.stringify(requestParams));

    console.log("🔹 Raw TopPay Response:", responseJson);

    // ✅ Parse TopPay response safely
    let parsedResponse =
      responseJson?.topPayResponse || responseJson?.responseJson || responseJson;

    if (typeof parsedResponse === "string") {
      try {
        parsedResponse = JSON.parse(parsedResponse);
      } catch {
        console.error("❌ Failed to parse response string");
        return res.json({ success: false, error: "Invalid JSON from TopPay" });
      }
    }

    const payUrl = parsedResponse?.data?.payUrl;

    if (!payUrl) {
      return res.json({
        success: false,
        error: "Payment URL not found",
        parsedResponse,
      });
    }

    // ✅ Return success response
    return res.json({
      success: true,
      payUrl,
      order_sn:orderNumber,
    });
  } catch (error) {
    console.error("❌ Payment error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Payment processing failed",
    });
  }
};


// export const topnotify = async (req, res) => {
//   try {
//     const data = req.body;

//     // ---------- 0. Log the callback ----------
//     const logDir = path.join(process.cwd(), "logs");
//     if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

//     const now = new Date();
//     const logFile = path.join(logDir, `top_notify_payment${now.toISOString().slice(0, 10)}.log`);
//     const logEntry = {
//       time: now.toISOString(),
//       ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
//       body: data,
//     };
//     fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");

//     // ---------- 1. (SKIPPED) Verify TopPay signature ----------
//     console.warn("⚠️ Signature verification skipped intentionally for testing.");

//     // ---------- 2. Find recharge record ----------
//     const recharge = await rechargeTable.getRechargeByOrderId({ orderId: data.orderNum });
//     if (!recharge) {
//       console.log("Recharge not found for orderNum:", data.orderNum);
//       return res.status(404).send("Recharge not found");
//     }

//     // ---------- 3. Map TopPay status ----------
//     // TopPay status: 20=Processing, 30=Success, 40=Failure
//     let numericStatus;
//     if (data.status === "30") numericStatus = PaymentStatusMap.SUCCESS;
//     else if (data.status === "40") numericStatus = PaymentStatusMap.CANCELLED;
//     else numericStatus = PaymentStatusMap.PENDING;

//     // ---------- 4. Update recharge and user balance ----------
//     if (numericStatus === PaymentStatusMap.SUCCESS && recharge.status !== PaymentStatusMap.SUCCESS) {
//       await rechargeTable.setRechargeStatusById({
//         id: recharge.id,
//         status: PaymentStatusMap.SUCCESS,
//       });

//       const user = await getUserDataByPhoneNumber(recharge.phone);
//       await addUserAccountBalance({
//         money: recharge.money,
//         phone: recharge.phone,
//         invite: user?.invite || null,
//         rechargeId: recharge.id,
//       });
//     } else if (numericStatus === PaymentStatusMap.CANCELLED) {
//       await rechargeTable.setRechargeStatusById({
//         id: recharge.id,
//         status: PaymentStatusMap.CANCELLED,
//       });
//     }

//     // ---------- 5. Respond success ----------
//     res.send("success");
//   } catch (err) {
//     console.error("❌ Notify error:", err);
//     return res.status(500).json({
//       status: false,
//       message: "Internal server error",
//       error: err.message,
//       stack: err.stack,
//     });
//   }
// };

export const topnotify = async (req, res) => {
  try {
    const data = req.body;

    // ---------- 0. Log the callback ----------
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const logFile = path.join(logDir, `top_notify_payment_${dateStr}.log`);
    const logEntry = {
      time: now.toISOString(),
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      body: data,
    };
    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");

    // ---------- 1. (SKIPPED) Verify TopPay signature ----------
    console.warn("⚠️ Signature verification skipped intentionally for testing.");

    // ---------- 2. Find recharge record ----------
    const recharge = await rechargeTable.getRechargeByOrderId({ orderId: data.orderNum });
    if (!recharge) {
      console.log("Recharge not found for orderNum:", data.orderNum);

      // 🔴 Log the missing recharge case in error log
      const errorLogFile = path.join(logDir, `top_notify_payment_error_${dateStr}.log`);
      fs.appendFileSync(
        errorLogFile,
        `[${now.toISOString()}] ❌ Recharge not found for orderNum: ${data.orderNum}\n`,
        "utf8"
      );

      return res.status(404).send("Recharge not found");
    }

    // ---------- 3. Map TopPay status ----------
    let numericStatus;
    if (data.status === "30") numericStatus = PaymentStatusMap.SUCCESS;
    else if (data.status === "40") numericStatus = PaymentStatusMap.CANCELLED;
    else numericStatus = PaymentStatusMap.PENDING;

    // ---------- 4. Update recharge and user balance ----------
    if (numericStatus === PaymentStatusMap.SUCCESS && recharge.status !== PaymentStatusMap.SUCCESS) {
      await rechargeTable.setRechargeStatusById({
        id: recharge.id,
        status: PaymentStatusMap.SUCCESS,
      });

      const user = await getUserDataByPhoneNumber(recharge.phone);
      await addUserAccountBalance({
        money: recharge.money,
        phone: recharge.phone,
        invite: user?.invite || null,
        rechargeId: recharge.id,
      });
    } else if (numericStatus === PaymentStatusMap.CANCELLED) {
      await rechargeTable.setRechargeStatusById({
        id: recharge.id,
        status: PaymentStatusMap.CANCELLED,
      });
    }

    // ---------- 5. Respond success ----------
    res.send("success");
  } catch (err) {
    // 🔴 Error Logging Section
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const now = new Date();
    const errorLogFile = path.join(logDir, `top_notify_payment_error_${now.toISOString().slice(0, 10)}.log`);
    const errorEntry = `[${now.toISOString()}] ❌ Error: ${err.message}\nStack: ${err.stack}\n\n`;
    fs.appendFileSync(errorLogFile, errorEntry, "utf8");

    console.error("❌ Notify error:", err);

    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};


export const lgnotify = async (req, res) => {
  try {
    // LG sends x-www-form-urlencoded
    const data = req.body;

    // ---------- 0. Logging ----------
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const now = new Date();
    const logFile = path.join(logDir, `lg_notify_${now.toISOString().slice(0, 10)}.log`);
    const logEntry = {
      time: now.toISOString(),
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      body: data,
    };
    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + '\n', 'utf8');

    // ---------- 1. Verify Signature ----------
    const { order_sn, money, status, pay_time, msg, remark, sign } = data;
    const merchantKey = process.env.LG_PAY_KEY; // your private key

    const rawSignString = `order_sn=${order_sn}&money=${money}&status=${status}&pay_time=${pay_time}&msg=${msg}&key=${merchantKey}`;
    const localSign = crypto.createHash('md5').update(rawSignString).digest('hex').toLowerCase();

    if (localSign !== sign.toLowerCase()) {
      console.warn('❌ Invalid signature, ignoring callback:', data);
      return res.status(400).send('invalid sign');
    }

    // ---------- 2. Find Recharge ----------
    const recharge = await rechargeTable.getRechargeByOrderId({ orderId: order_sn });
    if (!recharge) {
      console.log('⚠️ Recharge not found for order_sn:', order_sn);
      return res.status(404).send('Recharge not found');
    }

    // ---------- 3. Update Order ----------
    if (parseInt(status) === 1 && recharge.status !== PaymentStatusMap.SUCCESS) {
      // Mark success
      await rechargeTable.setRechargeStatusById({
        id: recharge.id,
        status: PaymentStatusMap.SUCCESS
      });

      // Add user balance
      const user = await getUserDataByPhone(recharge.phone);
      await addUserAccountBalance({
        money: recharge.money,
        phone: recharge.phone,
        invite: user.invite || null,
        rechargeId: recharge.id,
      });
    }

    // ---------- 4. Respond to LG Pay ----------
    // Must return pure string "ok"
    res.send('ok');

  } catch (err) {
    console.error('💥 LG Notify error:', err);
    res.status(500).send('Internal server error');
  }
};

// === USDT SETTINGS CONTROLLERS ===
export const updateUsdtSettings = async (req, res) => {
  const id = 1; // single record
  const { 
    usdt_upi, 
    usdt_qr_is_active, 
    usdt_upi_is_active, 
    usdt_conversion_rate,
    NetworkType 
  } = req.body;

  const qrFile = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    // ✅ Delete old QR image if a new one was uploaded
    if (qrFile) {
      const [old] = await pool.query(
        'SELECT usdt_qr_code FROM manual_usdt_settings WHERE id = ?',
        [id]
      );

      if (old[0]?.usdt_qr_code) {
        const oldPath = path.join(__dirname, '..', 'public', old[0].usdt_qr_code);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    }

    // ✅ Update all fields, including NetworkType
    const [result] = await pool.query(
      `
      UPDATE manual_usdt_settings 
      SET 
        usdt_qr_code = COALESCE(?, usdt_qr_code),
        usdt_upi = ?,
        usdt_qr_is_active = ?,
        usdt_upi_is_active = ?,
        usdt_conversion_rate = ?,
        NetworkType = ?
      WHERE id = ?
      `,
      [
        qrFile,
        usdt_upi,
        usdt_qr_is_active ?? 0,
        usdt_upi_is_active ?? 0,
        usdt_conversion_rate,
        NetworkType,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: 'Record not found'
      });
    }

    // ✅ Success response
    res.json({
      status: true,
      message: 'USDT settings updated successfully',
      file: qrFile || 'unchanged'
    });

  } catch (err) {
    console.error('Error updating USDT settings:', err);
    res.status(500).json({
      status: false,
      message: err.message
    });
  }
};



const getUsdtSettings = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM manual_usdt_settings WHERE id = 1');
    res.json({ status: true, data: rows[0] || {} });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};


const usedpage = async (req, res) => {
    try {
        // URL query se amount get karo
        const amount = req.query.amount || 0; // ?amount=250
        const [rows] = await pool.query('SELECT * FROM manual_usdt_settings WHERE id = 1');
        const usdtSettings = rows[0] || {};

        return res.render("manage/useusdt.ejs", {
            amount,
            usdtSettings
        });

    } catch (error) {
        console.error("Error in usedpage:", error);
        return res.status(500).send("Server error");
    }
};




const addManualUSDTPaymentRequest = async (req, res) => {
  const timeNow = new Date().toISOString();
  try {
    const data = req.body;
    const auth = req.cookies.auth;

    const money_usdt = parseFloat(data.money); // USDT amount
    const utr = data.utr?.trim(); // UTR as string
    const minimumMoneyAllowed = 10;

    // Validate money
    if (!money_usdt || money_usdt < minimumMoneyAllowed) {
      return res.status(400).json({
        message: `Money is required and should be USDT ${minimumMoneyAllowed} or above!`,
        status: false,
        timeStamp: timeNow,
      });
    }

    // Validate UTR
    if (!utr || utr.length < 12 || utr.length > 16) {
      return res.status(400).json({
        message: "Ref No. or UTR is required (12–16 characters)!",
        status: false,
        timeStamp: timeNow,
      });
    }

    // Get user by auth token
    const user = await getUserDataByAuthToken(auth);
    if (!user) {
      return res.status(401).json({
        message: "User not authenticated!",
        status: false,
        timeStamp: timeNow,
      });
    }

    // Fetch USDT settings
    const [rows] = await pool.query("SELECT * FROM manual_usdt_settings WHERE id = 1");
    const usdtSettings = rows[0] || {};
    const money = money_usdt * usdtSettings.usdt_conversion_rate;

    // Cancel any pending USDT manual recharges
    const [pendingRows] = await pool.query(
      "SELECT id FROM recharge WHERE phone = ? AND status = 0 AND type = ?",
      [user.phone, "USDT_MANUAL"]
    );

    if (pendingRows.length > 0) {
      const pendingIds = pendingRows.map(r => r.id); // Correct column name
      const placeholders = pendingIds.map(() => "?").join(",");
      await pool.query(
        `UPDATE recharge SET status = -1 WHERE id IN (${placeholders})`,
        pendingIds
      );
    }

    // Generate unique order ID
    const orderId = `USDT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Prepare new recharge data
    const newRecharge = {
      orderId: orderId,
      transactionId: null,
      utr: utr,
      phone: user.phone,
      money: money,
      type: "USDT_MANUAL",
      status: 0, // pending
      today: rechargeTable.getCurrentTimeForTodayField(),
      url: null,
      time: rechargeTable.getCurrentTimeForTimeField(),
    };

    // Insert new recharge record using table helper
    const recharge = await rechargeTable.create(newRecharge);

    return res.status(200).json({
      message: "Payment requested successfully. Your balance will update shortly!",
      rechargeId: recharge.id,
      status: true,
      timeStamp: timeNow,
    });
  } catch (error) {
    console.error("Error in addManualUSDTPaymentRequest:", error);
    return res.status(500).json({
      status: false,
      message: "Something went wrong!",
      error: error.message,
      stack: error.stack,
      timeStamp: timeNow,
    });
  }
};









const getRechargeOrderId = () => {
  const date = new Date();
  let id_time =
    date.getUTCFullYear() +
    "" +
    date.getUTCMonth() +
    1 +
    "" +
    date.getUTCDate();
  let id_order =
    Math.floor(Math.random() * (99999999999999 - 10000000000000 + 1)) +
    10000000000000;

  return id_time + id_order;
};


const rechargeTable = {
  getRecordByPhoneAndStatus: async ({ phone, status, type }) => {
    if (
      ![
        PaymentStatusMap.SUCCESS,
        PaymentStatusMap.CANCELLED,
        PaymentStatusMap.PENDING,
      ].includes(status)
    ) {
      throw Error("Invalid Payment Status!");
    }

    let recharge;

    if (type) {
      [recharge] = await connection.query(
        "SELECT * FROM recharge WHERE phone = ? AND status = ? AND type = ?",
        [phone, status, type],
      );
    } else {
      [recharge] = await connection.query(
        "SELECT * FROM recharge WHERE phone = ? AND status = ?",
        [phone, status],
      );
    }

    return recharge.map((item) => ({
      id: item.id,
      orderId: item.id_order,
      transactionId: item.transaction_id,
      utr: item.utr,
      phone: item.phone,
      money: item.money,
      type: item.type,
      status: item.status,
      today: item.today,
      url: item.url,
      time: item.time,
    }));
  },
  getRechargeByOrderId: async ({ orderId }) => {
    const [recharge] = await connection.query(
      "SELECT * FROM recharge WHERE id_order = ?",
      [orderId],
    );

    if (recharge.length === 0) {
      return null;
    }

    return recharge.map((item) => ({
      id: item.id,
      orderId: item.id_order,
      transactionId: item.transaction_id,
      utr: item.utr,
      phone: item.phone,
      money: item.money,
      type: item.type,
      status: item.status,
      today: item.today,
      url: item.url,
      time: item.time,
    }))?.[0];
  },
  getRechargeById: async ({ id }) => {
    const [recharge] = await connection.query(
      "SELECT * FROM recharge WHERE id = ? LIMIT 1",
      [id],
    );

    if (recharge.length === 0) {
      return null;
    }

    return recharge.map((item) => ({
      id: item.id,
      orderId: item.id_order,
      transactionId: item.transaction_id,
      utr: item.utr,
      phone: item.phone,
      money: item.money,
      type: item.type,
      status: item.status,
      today: item.today,
      url: item.url,
      time: item.time,
    }))?.[0];
  },
  totalRechargeCount: async (status, phone) => {
    if (!status || !phone)
      throw new AppError("Invalid Status or Phone", 400);

    const [totalRechargeRow] = await connection.query(
      "SELECT COUNT(*) as count FROM recharge WHERE phone = ? AND status = ?",
      [phone, status],
    );
    const totalRecharge = totalRechargeRow[0].count || 0;
    return totalRecharge;
  },
  updateRemainingBet: async (phone, money, rechargeId, totalRecharge) => {

    const [previousRecharge] = await connection.query(
      `SELECT remaining_bet FROM recharge WHERE phone = ? AND status = 1 ORDER BY time_remaining_bet DESC LIMIT 2`,
      [phone],
    );

    const previousRemainingBet = previousRecharge?.[1]?.remaining_bet || 0;

    const totalRemainingBet =
      totalRecharge === 0 ? money : previousRemainingBet + money;

    await connection.query(
      "UPDATE recharge SET remaining_bet = ? WHERE id = ?",
      [totalRemainingBet, rechargeId],
    );
  },
  cancelById: async (id) => {
    if (typeof id !== "number") {
      throw Error("Invalid Recharge 'id' expected a number!");
    }

    await connection.query("UPDATE recharge SET status = 2 WHERE id = ?", [id]);
  },
  setRechargeStatusById: async ({ id, status }) => {
    if (typeof id !== "number") {
      throw Error("Invalid Recharge 'id' expected a number!");
    }

    if (
      ![
        PaymentStatusMap.SUCCESS,
        PaymentStatusMap.CANCELLED,
        PaymentStatusMap.PENDING,
      ].includes(status)
    ) {
      throw Error("Invalid Payment Status!");
    }

    await connection.query("UPDATE recharge SET status = ? WHERE id = ?", [
      status,
      id,
    ]);
  },
  setStatusToSuccessByIdAndOrderId: async ({ id, orderId, utr }) => {
    if (typeof id !== "number") {
      throw Error("Invalid Recharge 'id' expected a number!");
    }

    if (utr) {
      await connection.query(
        "UPDATE recharge SET status = 1, utr = ? WHERE id = ? AND id_order = ?",
        [utr, id, orderId],
      );
    } else {
      await connection.query(
        "UPDATE recharge SET status = 1 WHERE id = ? AND id_order = ?",
        [id, orderId],
      );
    }
  },
  getCurrentTimeForTimeField: () => {
    return moment().valueOf();
  },
  getCurrentTimeForTodayField: () => {
    return moment().format("YYYY-DD-MM h:mm:ss A");
  },
  getDMYDateOfTodayFiled: (today) => {
    return moment(today, "YYYY-DD-MM h:mm:ss A").format("DD-MM-YYYY");
  },
  create: async (newRecharge) => {
    if (newRecharge.url === undefined || newRecharge.url === null) {
      newRecharge.url = "0";
    }

    await connection.query(
      `INSERT INTO recharge SET id_order = ?, transaction_id = ?, phone = ?, money = ?, type = ?, status = ?, today = ?, url = ?, time = ?, time_remaining_bet = ?, utr = ?`,
      [
        newRecharge.orderId,
        newRecharge.transactionId,
        newRecharge.phone,
        newRecharge.money,
        newRecharge.type,
        newRecharge.status,
        newRecharge.today,
        newRecharge.url,
        newRecharge.time,
        newRecharge.time,
        newRecharge?.utr,
      ],
    );

    const [recharge] = await connection.query(
      "SELECT * FROM recharge WHERE id_order = ?",
      [newRecharge.orderId],
    );

    if (recharge.length === 0) {
      throw Error("Unable to create recharge!");
    }

    return recharge[0];
  },
};


const approveRecharge = async (req, res) => {
  try {
    const { id, status } = req.body;
    const auth = req.cookies.auth;

    if (!id) {
      return res.status(400).json({ status: false, message: "Recharge ID missing" });
    }

    const user = await getUserDataByAuthToken(auth);
    if (!user) {
      return res.status(401).json({ status: false, message: "Unauthorized or invalid token" });
    }

    // Map status string (from client) to numeric DB value
    const statusMapStringToNumber = {
      SUCCESS: PaymentStatusMap.SUCCESS,
      CANCELLED: PaymentStatusMap.CANCELLED,
    };

    const numericStatus = statusMapStringToNumber[status] ?? status; // support number or string

    // Validate status
    if (![PaymentStatusMap.SUCCESS, PaymentStatusMap.CANCELLED].includes(numericStatus)) {
      return res.status(400).json({ status: false, message: "Invalid status provided" });
    }

    // Fetch recharge details
    const recharge = await rechargeTable.getRechargeById({ id });
    if (!recharge) {
      return res.status(404).json({ status: false, message: "Recharge not found" });
    }

    // Prevent double approval
    if (recharge.status === PaymentStatusMap.SUCCESS && numericStatus === PaymentStatusMap.SUCCESS) {
      return res.status(400).json({ status: false, message: "Recharge already approved" });
    }

    // APPROVE RECHARGE
    if (numericStatus === PaymentStatusMap.SUCCESS) {
      await rechargeTable.setRechargeStatusById({
        id: recharge.id,
        status: PaymentStatusMap.SUCCESS,
      });

      // Add money to user wallet
      await addUserAccountBalance({
        money: recharge.money,
        phone: recharge.phone,
        invite: user.invite || null,
        rechargeId: recharge.id,
      });

      return res.status(200).json({
        status: true,
        recharge,
        recharge_money: recharge.money,
        message: "Recharge approved and balance added successfully",
      });
    }

    // CANCEL RECHARGE
    if (numericStatus === PaymentStatusMap.CANCELLED) {
      await rechargeTable.setRechargeStatusById({
        id: recharge.id,
        status: PaymentStatusMap.CANCELLED,
      });

      return res.status(200).json({
        status: true,
        recharge,
        message: "Recharge cancelled successfully",
      });
    }

  } catch (err) {
    console.error("approveRecharge error:", err);
    return res.status(500).json({
      status: false,
      message: err.message || "Internal server error",
    });
  }
};





const addUserAccountBalance = async ({ money, phone, invite, rechargeId }) => {
  const totalRecharge = await rechargeTable.totalRechargeCount(
    PaymentStatusMap.SUCCESS,
    phone,
  );


//   const bonus = (money / 100) * 5;

//   const user_money = money ;
  const firstRechargeBonus = totalRecharge === 1 ? money * 0.2 : 0;

//   const dailyRechargeBonus = money >= 50000 ? bonus : 0;
//   const totalInviterMoney = firstRechargeBonus;
    const user_money = money + firstRechargeBonus ;

  await addUserMoney(phone, money);


  await rechargeTable.updateRemainingBet(
    phone,
    user_money,
    rechargeId,
    totalRecharge,
  );

  const rewardType =
    totalRecharge === 1
      ? REWARD_TYPES_MAP.FIRST_RECHARGE_BONUS
      : REWARD_TYPES_MAP.DAILY_RECHARGE_BONUS;
//   await addUserRewards(phone, firstRechargeBonus, rewardType);

 

  const inviter = await getUserByInviteCode(invite);

  if (inviter) {
    if (firstRechargeBonus !== 0) {
      await addUserRewards(
        inviter.phone,
        firstRechargeBonus,
        REWARD_TYPES_MAP.FIRST_RECHARGE_AGENT_BONUS,
      );
    }

    // if (dailyRechargeBonus !== 0) {
    //   await addUserRewards(
    //     inviter.phone,
    //     dailyRechargeBonus,
    //     REWARD_TYPES_MAP.DAILY_RECHARGE_AGENT_BONUS,
    //   );
    // }

    // if (totalInviterMoney !== 0) {
    //   await addUserMoney(inviter.phone, totalInviterMoney);
    // }
  }
};


const addUserRewards = async (phone, bonus, rewardType) => {
  if (!phone || !bonus || !rewardType)
    throw new AppError(`add User Rewards Invalid Parameters phone ${phone} or bonus ${bonus} or rewardType ${rewardType}`, 400);
  const reward_id = generateClaimRewardID();
  let timeNow = Date.now();

  await connection.query(
    "INSERT INTO claimed_rewards (reward_id,phone, amount, type, time, status) VALUES (?,?,?,?,?,?)",
    [
      reward_id,
      phone,
      bonus,
      rewardType,
      timeNow,
      REWARD_STATUS_TYPES_MAP.SUCCESS,
    ],
  );
};

const addUserMoney = async (phone, money) => {
  if (!phone || !money) {
    throw new AppError(`add User Money phone ${phone} or money ${money} not provided`, 400);
  }
  // update user money
  await connection.query(
    "UPDATE users SET money = money + ?, total_money = total_money + ? WHERE `phone` = ?",
    [money, money, phone],
  );
};


const getUserByInviteCode = async (invite) => {
  if (!invite)
    throw new AppError("invite code not provided", 400);
  const [inviter] = await connection.query(
    "SELECT phone FROM users WHERE `code` = ?",
    [invite],
  );
  return inviter?.[0] || null;
};




// === Export controller ===
const payment2Controller = { webpay,lg_pay,lgnotify, topnotify, updateUsdtSettings, getUsdtSettings,usedpage,addManualUSDTPaymentRequest,approveRecharge };
export default payment2Controller;

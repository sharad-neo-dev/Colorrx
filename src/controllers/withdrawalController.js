import moment from "moment";
import connection from "../config/connectDB.js";
import crypto from "node:crypto";
import qs from "qs";
import fs from "fs";
import path from "path";
import axios from "axios";
import { TopPaySignUtil } from "./TopPaySignUtil.js";

const WITHDRAWAL_METHODS_MAP = {
  USDT_ADDRESS: "USDT_ADDRESS",
  BANK_CARD: "BANK_CARD",
};

const WITHDRAWAL_STATUS_MAP = {
  PENDING: 0,
  APPROVED: 1,
  DENIED: 2,
};

const addBankCardPage = async (req, res) => {
  return res.render("wallet/addbank.ejs");
};

const selectBankPage = async (req, res) => {
  return res.render("wallet/selectBank.ejs");
};

const addUSDTAddressPage = async (req, res) => {
  return res.render("wallet/addAddress.ejs");
};

const addBankCard = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;

    if (!auth) {
      return res.status(400).json({
        message: "Auth is required to fulfill the request!",
        status: false,
        timeStamp: timeNow,
      });
    }

    let bankName = req.body.bankName;
    let recipientName = req.body.recipientName;
    let bankAccountNumber = req.body.bankAccountNumber;
    let phoneNumber = req.body.phoneNumber;
    let IFSC = req.body.IFSC;
    let upiId = req.body.upiId;

    if (
      !bankName ||
      !recipientName ||
      !bankAccountNumber ||
      !phoneNumber ||
      !IFSC ||
      !upiId
    ) {
      return res.status(400).json({
        message: "Please fill the required fields",
        status: false,
        timeStamp: timeNow,
      });
    }

    const user = await getUserDataByAuthToken(auth);

    const account = await AccountDB.getUserBankCard({
      userPhoneNumber: user.phone,
    });

    if (account.isAvailable) {
      const account = await AccountDB.updateUserBankCard({
        userPhoneNumber: user.phone,
        bankName,
        recipientName,
        bankAccountNumber,
        phoneNumber,
        IFSC,
        upiId,
      });

      return res.status(200).json({
        account,
        message: "Successfully Updated Bank Card",
        status: true,
        timeStamp: timeNow,
      });
    } else {
      const account = await AccountDB.createUserBankCard({
        userPhoneNumber: user.phone,
        bankName,
        recipientName,
        bankAccountNumber,
        phoneNumber,
        IFSC,
        upiId,
      });

      return res.status(200).json({
        account,
        message: "Successfully Created Bank Card",
        status: true,
        timeStamp: timeNow,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      timeStamp: timeNow,
    });
  }
};

const getBankCardInfo = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;

    if (!auth) {
      return res.status(400).json({
        message: "Auth is required to fulfill the request!",
        status: false,
        timeStamp: timeNow,
      });
    }

    const user = await getUserDataByAuthToken(auth);

    const account = await AccountDB.getUserBankCard({
      userPhoneNumber: user.phone,
    });

    return res.status(200).json({
      account,
      message: "Successfully fetched Bank Card",
      status: true,
      timeStamp: timeNow,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      timeStamp: timeNow,
    });
  }
};

const addUSDTAddress = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;

    if (!auth) {
      return res.status(400).json({
        message: "Auth is required to fulfill the request!",
        status: false,
        timeStamp: timeNow,
      });
    }

    let mainNetwork = req.body.mainNetwork;
    let usdtAddress = req.body.usdtAddress;
    let addressAlias = req.body.addressAlias;

    if (!mainNetwork || !usdtAddress || !addressAlias) {
      return res.status(400).json({
        message: "Please fill the required fields",
        status: false,
        timeStamp: timeNow,
      });
    }

    const user = await getUserDataByAuthToken(auth);

    const account = await AccountDB.getUserUSDTAddress({
      userPhoneNumber: user.phone,
    });

    if (account.isAvailable) {
      const account = await AccountDB.updateUserUSDTAddress({
        userPhoneNumber: user.phone,
        mainNetwork,
        usdtAddress,
        addressAlias,
      });

      return res.status(200).json({
        account,
        message: "Successfully Updated USDT Address",
        status: true,
        timeStamp: timeNow,
      });
    } else {
      const account = await AccountDB.createUserUSDTAddress({
        userPhoneNumber: user.phone,
        mainNetwork,
        usdtAddress,
        addressAlias,
      });

      return res.status(200).json({
        account,
        message: "Successfully Created USDT Address",
        status: true,
        timeStamp: timeNow,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      timeStamp: timeNow,
    });
  }
};

const getUSDTAddressInfo = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;

    if (!auth) {
      return res.status(400).json({
        message: "Auth is required to fulfill the request!",
        status: false,
        timeStamp: timeNow,
      });
    }

    const user = await getUserDataByAuthToken(auth);

    const account = await AccountDB.getUserUSDTAddress({
      userPhoneNumber: user.phone,
    });

    return res.status(200).json({
      account,
      message: "Successfully fetched USDT Address",
      status: true,
      timeStamp: timeNow,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      timeStamp: timeNow,
    });
  }
};

const createWithdrawalRequest = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;

    if (!auth) {
      return res.status(400).json({
        message: "Auth is required to fulfill the request!",
        status: false,
        timeStamp: timeNow,
      });
    }

    let withdrawalMethod = req.body.withdrawalMethod;
    let amount = req.body.amount || 0;
    let AllowedWithdrawAmount = req.body.AllowedWithdrawAmount || false;
    let totalBetAmountRemaining = req.body.totalBetAmountRemaining || 0;

    if (!withdrawalMethod) {
      return res.status(400).json({
        message: "Please select the Withdrawal Method of your choice!",
        status: false,
        timeStamp: timeNow,
      });
    }

    if (
      WITHDRAWAL_METHODS_MAP.BANK_CARD !== withdrawalMethod &&
      WITHDRAWAL_METHODS_MAP.USDT_ADDRESS !== withdrawalMethod
    ) {
      return res.status(400).json({
        message: "Please select a valid the Withdrawal Method!",
        status: false,
        timeStamp: timeNow,
      });
    }

    const user = await getUserDataByAuthToken(auth);

    const [rechargeRow] = await connection.query(
      "SELECT * FROM recharge WHERE phone = ? AND status = 1",
      [user.phone],
    );

    if (rechargeRow.length === 0) {
      return res.status(400).json({
        message: "You must deposit first to withdraw",
        status: false,
        timeStamp: timeNow,
      });
    }

    let account = { isAvailable: false };

    if (WITHDRAWAL_METHODS_MAP.BANK_CARD === withdrawalMethod) {
      account = await AccountDB.getUserBankCard({
        userPhoneNumber: user.phone,
      });
    } else {
      account = await AccountDB.getUserUSDTAddress({
        userPhoneNumber: user.phone,
      });
    }

    if (!account.isAvailable) {
      return res.status(400).json({
        message: "Please add your withdrawal method first!",
        status: false,
        timeStamp: timeNow,
      });
    }

    const minimumMoneyAllowed =
      withdrawalMethod === WITHDRAWAL_METHODS_MAP.BANK_CARD
        ? parseInt(process.env.MINIMUM_WITHDRAWAL_MONEY_INR)
        : parseInt(process.env.MINIMUM_WITHDRAWAL_MONEY_USDT);

    let actualAmount =
      withdrawalMethod === WITHDRAWAL_METHODS_MAP.BANK_CARD
        ? parseInt(amount)
        : parseInt(amount) * parseInt(process.env.USDT_INR_EXCHANGE_RATE);

    if (amount < minimumMoneyAllowed) {
      return res.status(400).json({
        message: `You can withdraw minimum balance of ${withdrawalMethod === WITHDRAWAL_METHODS_MAP.BANK_CARD ? "₹" : "$"} ${minimumMoneyAllowed}`,
        status: false,
        timeStamp: timeNow,
      });
    }

    if (Number(user.money) < Number(actualAmount)) {
      return res.status(400).json({
        message: "The balance is not enough to fulfill the request",
        status: false,
        timeStamp: timeNow,
      });
    }

    // const totalBettingAmount = await gamesDB.getTotalBettingAmount({ userPhoneNumber: user.phone })
    // const totalDepositAmount = await depositDB.getTotalDeposit({ userPhoneNumber: user.phone })
    // const result = totalDepositAmount - totalBettingAmount > 0 ? totalDepositAmount - totalBettingAmount : 0

    if (!AllowedWithdrawAmount) {
      return res.status(400).json({
        message: "You must bet ₹ " + totalBetAmountRemaining + " to withdraw",
        status: false,
        timeStamp: timeNow,
      });
    }

    if (withdrawalMethod === WITHDRAWAL_METHODS_MAP.BANK_CARD) {
      const withd = await connection.query(
        "UPDATE users SET money = money - ?, total_money = total_money - ? WHERE `phone` = ? AND money >= ?",
        [amount, amount, user.phone, amount],
      );

      console.log(withd);

      withdrawDB.createBankCardWithdrawalRequest({
        userPhoneNumber: user.phone,
        bankName: account.bankName,
        recipientName: account.recipientName,
        bankAccountNumber: account.bankAccountNumber,
        IFSC: account.IFSC,
        upiId: account.upiId,
        amount: amount,
      });

      return res.status(200).json({
        message: "Withdrawal request registered Successfully!",
        status: true,
        timeStamp: timeNow,
      });
    }

    if (withdrawalMethod === WITHDRAWAL_METHODS_MAP.USDT_ADDRESS) {
      const withd = await connection.query(
        "UPDATE users SET money = money - ?, total_money = total_money - ? WHERE `phone` = ? AND money >= ?",
        [actualAmount, actualAmount, user.phone, amount],
      );

      console.log(withd);

      withdrawDB.createUSDTWithdrawalRequest({
        userPhoneNumber: user.phone,
        mainNetwork: account.mainNetwork,
        usdtAddress: account.usdtAddress,
        addressAlias: account.addressAlias,
        amount: amount,
      });

      return res.status(200).json({
        message: "Withdrawal request registered Successfully!",
        status: true,
        timeStamp: timeNow,
      });
    }

    return res.status(400).json({
      message: "Please select a valid the Withdrawal Method!",
      status: true,
      timeStamp: timeNow,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      timeStamp: timeNow,
    });
  }
};

const listWithdrawalRequests = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;

    if (!auth) {
      return res.status(400).json({
        message: "Auth is required to fulfill the request!",
        status: false,
        timeStamp: timeNow,
      });
    }

    const withdraw = await withdrawDB.getWithdrawalList({
      status: WITHDRAWAL_STATUS_MAP.PENDING,
    });

    return res.status(200).json({
      message: "Withdrawal request fetched!",
      withdrawList: withdraw.isAvailable ? withdraw.withdrawalList : [],
      status: true,
      timeStamp: timeNow,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      timeStamp: timeNow,
    });
  }
};

const listWithdrawalHistory = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;

    if (!auth) {
      return res.status(400).json({
        message: "Auth is required to fulfill the request!",
        status: false,
        timeStamp: timeNow,
      });
    }

    const user = await getUserDataByAuthToken(auth);

    const withdraw = await withdrawDB.getWithdrawalList({
      status: undefined,
      userPhoneNumber: user.phone,
    });

    return res.status(200).json({
      message: "Withdrawal request fetched!",
      withdrawList: withdraw.isAvailable ? withdraw.withdrawalList : [],
      status: true,
      timeStamp: timeNow,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      timeStamp: timeNow,
    });
  }
};

const approveOrDenyWithdrawalRequest = async (req, res) => {
  let timeNow = Date.now();
  try {
    let auth = req.cookies.auth;
    let id = req.body.id;
    let status = req.body.status;
    let remarks = req.body.remarks;

    if (!auth) {
      return res.status(400).json({
        message: "Admin authentication is required!",
        status: false,
        timeStamp: timeNow,
      });
    }

    if (!id || !status) {
      return res.status(400).json({
        message: "Please Provide the required fields!",
        status: false,
        timeStamp: timeNow,
      });
    }

    const withdraw = await withdrawDB.getWithdrawalById(id);

    if (!withdraw.isAvailable) {
      return res.status(400).json({
        message: "Withdrawal request not found!",
        status: false,
        timeStamp: timeNow,
      });
    }

    if (status == WITHDRAWAL_STATUS_MAP.APPROVED) {
      await connection.execute(
        `UPDATE withdraw SET status = 1, remarks = ? WHERE id = ?`,
        [remarks, id],
      );

      return res.status(200).json({
        message: "Approved Withdrawal Request!",
        status: true,
        timeStamp: timeNow,
      });
    }

    if (status == WITHDRAWAL_STATUS_MAP.DENIED) {
      const amount = Number(withdraw.withdrawal.amount);
      let actualAmount =
        withdraw.withdrawal.type === WITHDRAWAL_METHODS_MAP.BANK_CARD
          ? Number(amount)
          : Number(amount) * Number(process.env.USDT_INR_EXCHANGE_RATE);
      console.log("amount", withdraw.withdrawal.phoneNumber);
      console.log("amount", withdraw.withdrawal);
      console.log("amount", process.env.USDT_INR_EXCHANGE_RATE);
      console.log("amount", amount);
      console.log("actualAmount", actualAmount);
      await connection.query(
        `UPDATE withdraw SET status = 2, remarks = ? WHERE id = ?`,
        [remarks, id],
      );

      await connection.query(
        "UPDATE users SET money = money + ? WHERE phone = ? ",
        [actualAmount, withdraw.withdrawal.phoneNumber],
      );

      return res.status(200).json({
        message: "Denied Withdrawal Request!",
        status: true,
        timeStamp: timeNow,
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Something went wrong!",
      status: false,
      timeStamp: timeNow,
    });
  }
};

// helpers ---------------
const getUserDataByAuthToken = async (authToken) => {
  let [users] = await connection.query(
    "SELECT `phone`, `code`,`name_user`,`invite`,`money` FROM users WHERE `token` = ? ",
    [authToken],
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
    money: user.money,
  };
};

const AccountDB = {
  async getUserBankCard({ userPhoneNumber }) {
    const type = WITHDRAWAL_METHODS_MAP.BANK_CARD;
    let [accounts] = await connection.query(
      "SELECT * FROM user_bank WHERE `phone` = ? AND `tp` = ?",
      [userPhoneNumber, type],
    );

    const account = accounts?.[0];

    if (account === undefined || account === null) {
      return {
        isAvailable: false,
      };
    }

    return {
      isAvailable: true,
      id: account.id,
      userPhoneNumber: account.phone,
      bankName: account.name_bank,
      recipientName: account.name_user,
      bankAccountNumber: account.stk,
      phoneNumber: account.tinh,
      IFSC: account.chi_nhanh,
      upiId: account.sdt,
      type,
    };
  },
  async createUserBankCard({
    userPhoneNumber,
    bankName,
    recipientName,
    bankAccountNumber,
    phoneNumber,
    IFSC,
    upiId,
  }) {
    let time = new Date().getTime();
    const type = WITHDRAWAL_METHODS_MAP.BANK_CARD;

    await connection.query(
      `INSERT INTO user_bank SET phone = '${userPhoneNumber}', name_bank = '${bankName}', name_user = '${recipientName}', stk = '${bankAccountNumber}', tinh = '${phoneNumber}', chi_nhanh = '${IFSC}', sdt = '${upiId}', tp = '${type}', time = '${time}'`,
    );

    let [accounts] = await connection.query(
      "SELECT * FROM user_bank WHERE `phone` = ? AND `tp` = ?",
      [userPhoneNumber, type],
    );

    const account = accounts?.[0];

    if (account === undefined || account === null) {
      return {
        isCreated: false,
      };
    }

    return {
      isCreated: true,
      userPhoneNumber: account.phone,
      bankName: account.name_bank,
      recipientName: account.name_user,
      bankAccountNumber: account.stk,
      phoneNumber: account.tinh,
      IFSC: account.chi_nhanh,
      upiId: account.sdt,
      type,
    };
  },
  async updateUserBankCard({
    userPhoneNumber,
    bankName,
    recipientName,
    bankAccountNumber,
    phoneNumber,
    IFSC,
    upiId,
  }) {
    let time = new Date().getTime();
    const type = WITHDRAWAL_METHODS_MAP.BANK_CARD;

    await connection.query(
      `UPDATE user_bank SET name_bank = '${bankName}', name_user = '${recipientName}', stk = '${bankAccountNumber}', tinh = '${phoneNumber}', chi_nhanh = '${IFSC}', sdt = '${upiId}', time = '${time}' WHERE phone = '${userPhoneNumber}' AND tp = '${type}'`,
    );

    let [accounts] = await connection.query(
      "SELECT * FROM user_bank WHERE `phone` = ? AND `tp` = ?",
      [userPhoneNumber, type],
    );

    const account = accounts?.[0];

    if (account === undefined || account === null) {
      return {
        isCreated: false,
      };
    }

    return {
      isAvailable: true,
      userPhoneNumber: account.phone,
      bankName: account.name_bank,
      recipientName: account.name_user,
      bankAccountNumber: account.stk,
      phoneNumber: account.tinh,
      IFSC: account.chi_nhanh,
      upiId: account.sdt,
      type,
    };
  },
  async getUserUSDTAddress({ userPhoneNumber }) {
    const type = WITHDRAWAL_METHODS_MAP.USDT_ADDRESS;
    let [accounts] = await connection.query(
      "SELECT * FROM user_bank WHERE `phone` = ? AND `tp` = ?",
      [userPhoneNumber, type],
    );

    const account = accounts?.[0];

    if (account === undefined || account === null) {
      return {
        isAvailable: false,
      };
    }

    return {
      isAvailable: true,
      id: account.id,
      userPhoneNumber: account.phone,
      mainNetwork: account.name_bank,
      usdtAddress: account.stk,
      addressAlias: account.sdt,
      type,
    };
  },
  async createUserUSDTAddress({
    userPhoneNumber,
    mainNetwork,
    usdtAddress,
    addressAlias,
  }) {
    let time = new Date().getTime();
    const type = WITHDRAWAL_METHODS_MAP.USDT_ADDRESS;

    await connection.query(
      `INSERT INTO user_bank SET phone = '${userPhoneNumber}', name_bank =' ${mainNetwork}', stk = '${usdtAddress}', sdt = '${addressAlias}', tp = '${type}', time = '${time}'`,
    );

    let [accounts] = await connection.query(
      "SELECT * FROM user_bank WHERE `phone` = ? AND `tp` = ?",
      [userPhoneNumber, type],
    );

    const account = accounts?.[0];

    if (account === undefined || account === null) {
      return {
        isCreated: false,
      };
    }

    return {
      isCreated: true,
      userPhoneNumber: account.phone,
      mainNetwork: account.name_bank,
      usdtAddress: account.stk,
      addressAlias: account.sdt,
      type,
    };
  },
  async updateUserUSDTAddress({
    userPhoneNumber,
    mainNetwork,
    usdtAddress,
    addressAlias,
  }) {
    let time = new Date().getTime();
    const type = WITHDRAWAL_METHODS_MAP.USDT_ADDRESS;

    await connection.query(
      `UPDATE user_bank SET name_bank = '${mainNetwork}', stk = '${usdtAddress}', sdt = '${addressAlias}', time = '${time}' WHERE phone = '${userPhoneNumber}' AND tp = '${type}'`,
    );

    let [accounts] = await connection.query(
      "SELECT * FROM user_bank WHERE `phone` = ? AND `tp` = ?",
      [userPhoneNumber, type],
    );

    const account = accounts?.[0];

    if (account === undefined || account === null) {
      return {
        isAvailable: false,
      };
    }

    return {
      isAvailable: true,
      userPhoneNumber: account.phone,
      mainNetwork: account.name_bank,
      usdtAddress: account.stk,
      addressAlias: account.sdt,
      type,
    };
  },
};

const getTodayString = () => {
  return moment().format("YYYY-MM-DD h:mm:ss A");
};
const getOrderId = () => {
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

  return id_time + "" + id_order;
};

const withdrawDB = {
  async getWithdrawalById(id) {
    let [withdrawalList] = await connection.query(
      "SELECT * FROM withdraw WHERE `id` = ?",
      [id],
    );

    if (withdrawalList.length === 0) {
      return {
        isAvailable: false,
      };
    }

    return {
      isAvailable: true,
      withdrawal: withdrawalList.map((item) => {
        if (item.tp === WITHDRAWAL_METHODS_MAP.BANK_CARD) {
          return {
            id: item.id,
            orderId: item.id_order,
            phoneNumber: item.phone,
            status: item.status,
            bankName: item.name_bank,
            recipientName: item.name_user,
            bankAccountNumber: item.stk,
            IFSC: item.ifsc,
            upiId: item.sdt,
            type: item.tp,
            time: item.time,
            today: item.today,
            amount: item.money,
            remarks: item.remarks,
          };
        } else if (item.tp === WITHDRAWAL_METHODS_MAP.USDT_ADDRESS) {
          return {
            id: item.id,
            orderId: item.id_order,
            phoneNumber: item.phone,
            status: item.status,
            mainNetwork: item.name_bank,
            usdtAddress: item.stk,
            addressAlias: item.sdt,
            type: item.tp,
            time: item.time,
            today: item.today,
            amount: item.money,
            remarks: item.remarks,
          };
        } else {
          return {
            id: item.id,
            orderId: item.id_order,
            phoneNumber: item.phone,
            status: item.status,
            bankName: item.name_bank,
            recipientName: item.name_user,
            bankAccountNumber: item.stk,
            IFSC: item.ifsc,
            upiId: item.sdt,
            type: item.tp,
            time: item.time,
            today: item.today,
            amount: item.money,
            remarks: item.remarks,
          };
        }
      })?.[0],
    };
  },
  async getWithdrawalList({ userPhoneNumber, status }) {
    let [withdrawalList] =
      status === undefined
        ? await connection.query("SELECT * FROM withdraw WHERE `phone` = ?", [
            userPhoneNumber,
          ])
        : userPhoneNumber
          ? await connection.query(
              "SELECT * FROM withdraw WHERE `phone` = ? AND `status` = ?",
              [userPhoneNumber, status],
            )
          : await connection.query(
              "SELECT * FROM withdraw WHERE `status` = ?",
              [status],
            );

    if (withdrawalList.length === 0) {
      return {
        isAvailable: false,
      };
    }

    return {
      isAvailable: true,
      withdrawalList: withdrawalList.map((item) => {
        if (item.tp === WITHDRAWAL_METHODS_MAP.BANK_CARD) {
          return {
            id: item.id,
            orderId: item.id_order,
            phoneNumber: item.phone,
            status: item.status,
            bankName: item.name_bank,
            recipientName: item.name_user,
            bankAccountNumber: item.stk,
            IFSC: item.ifsc,
            upiId: item.sdt,
            type: item.tp,
            Processing_in_top: item.Processing_in_top,
            time: item.time,
            today: item.today,
            amount: item.money,
            remarks: item.remarks,
          };
        } else if (item.tp === WITHDRAWAL_METHODS_MAP.USDT_ADDRESS) {
          return {
            id: item.id,
            orderId: item.id_order,
            phoneNumber: item.phone,
            status: item.status,
            mainNetwork: item.name_bank,
            usdtAddress: item.stk,
            addressAlias: item.sdt,
            type: item.tp,
            Processing_in_top: item.Processing_in_top,
            time: item.time,
            today: item.today,
            amount: item.money,
            remarks: item.remarks,
          };
        } else {
          return {
            id: item.id,
            orderId: item.id_order,
            phoneNumber: item.phone,
            status: item.status,
            bankName: item.name_bank,
            recipientName: item.name_user,
            Processing_in_top: item.Processing_in_top,
            bankAccountNumber: item.stk,
            IFSC: item.ifsc,
            upiId: item.sdt,
            type: item.tp,
            time: item.time,
            today: item.today,
            amount: item.money,
            remarks: item.remarks,
          };
        }
      }),
    };
  },
  async createUSDTWithdrawalRequest({
    userPhoneNumber,
    mainNetwork,
    usdtAddress,
    addressAlias,
    amount,
  }) {
    let time = new Date().getTime();
    const type = WITHDRAWAL_METHODS_MAP.USDT_ADDRESS;

    await connection.query(
      `INSERT INTO withdraw SET id_order = '${getOrderId()}', phone = '${userPhoneNumber}', name_bank = '${mainNetwork}', stk = '${usdtAddress}', sdt = '${addressAlias}', tp = '${type}', time = '${time}', today = '${getTodayString()}', money = '${amount}'`,
    );
  },
  async createBankCardWithdrawalRequest({
    userPhoneNumber,
    bankName,
    recipientName,
    bankAccountNumber,
    IFSC,
    upiId,
    amount,
  }) {
    let time = new Date().getTime(); //phoneNumber
    const type = WITHDRAWAL_METHODS_MAP.BANK_CARD;

    await connection.query(
      `INSERT INTO withdraw SET id_order = '${getOrderId()}', phone = '${userPhoneNumber}', name_bank = '${bankName}', name_user = '${recipientName}', stk = '${bankAccountNumber}', ifsc = '${IFSC}', sdt = '${upiId}', tp = '${type}', time = '${time}', today = '${getTodayString()}', money = '${amount}'`,
    );
  },
  async changeWithdrawalStatus({ status, id }) {
    await connection.query(
      `UPDATE users SET status = '${status}' WHERE id = ${id}`,
    );
  },
};

const gamesDB = {
  async getTotalBettingAmount({ userPhoneNumber }) {
    const [gameWingo] = await connection.query(
      "SELECT SUM(money) as totalBettingAmount FROM minutes_1 WHERE phone = ?",
      [userPhoneNumber],
    );
    const gameWingoBettingAmount = gameWingo[0].totalBettingAmount;

    const [gameK3] = await connection.query(
      "SELECT SUM(money) as totalBettingAmount FROM result_k3 WHERE phone = ?",
      [userPhoneNumber],
    );
    const gameK3BettingAmount = gameK3[0].totalBettingAmount;

    const [game5D] = await connection.query(
      "SELECT SUM(money) as totalBettingAmount FROM result_5d WHERE phone = ?",
      [userPhoneNumber],
    );
    const game5DBettingAmount = game5D[0].totalBettingAmount;

    return gameWingoBettingAmount + gameK3BettingAmount + game5DBettingAmount;
  },
};

const depositDB = {
  async getTotalDeposit({ userPhoneNumber }) {
    const [deposit] = await connection.query(
      "SELECT SUM(money) as totalDepositAmount FROM recharge WHERE phone = ? AND status = 1",
      [userPhoneNumber],
    );
    const totalDepositAmount = deposit[0].totalDepositAmount;

    return totalDepositAmount;
  },
};

/**
 * Enhanced logging utility
 * @param {string} type - Log type (e.g. 'toppay_withdraw', 'api_error')
 * @param {object} req - Express request object
 * @param {object} responseData - Response or data to log
 */
/**
 * 📘 Enhanced writeLog function
 * Logs everything — request, response, payloads, and errors — into /logs folder.
 */
export const writeLog = (type, req = {}, responseData = {}) => {
  try {
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    const now = new Date();
    const logFile = path.join(logDir, `${type}_${now.toISOString().slice(0, 10)}.log`);

    const clientIp =
      req.headers?.["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "unknown";

    const logEntry = {
      time: now.toISOString(),
      ip: clientIp,
      url: req.originalUrl || "",
      method: req.method || "",
      body: req.body || {},
      query: req.query || {},
      response: responseData,
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry, null, 2) + "\n", "utf8");
  } catch (err) {
    console.error("Failed to write log:", err.message);
  }
};

/**
 * 💸 sendToLGPay — Handles withdrawal payout via TopPay (LG Pay)
 * Logs all request + response data to /logs
 */
export const sendToLGPay = async (req, res) => {
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

  const REQ_URL = "https://india-openapi.toppay.asia/cash/newOrder";
  const CALLBACK_URL = "https://ace11.in/api/webapi/payment/top/withdrawNotify";

  try {
    const { id } = req.body;
    writeLog("withdraw", req, { receivedId: id });

    if (!id) {
      return res.status(400).json({ success: false, error: "Missing withdrawal ID" });
    }

    const withdrawal = await withdrawDB.getWithdrawalById(id);
    writeLog("withdraw", req, withdrawal);

    if (!withdrawal) {
      return res.status(404).json({ success: false, error: "Withdrawal not found" });
    }

    const w = withdrawal.withdrawal || withdrawal;
    const amountValue = Number(w.amount || 0);

    if (amountValue < 100) {
      return res.status(400).json({
        success: false,
        error: "Minimum withdrawal is ₹100",
      });
    }

    const orderNum = w.orderId || `WD${Date.now()}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // ✅ Build the parameter object
    const requestParams = {
      merchantCode: MCH_ID,
      orderNum,
      bankCode: w.IFSC,
      bankAccount: w.bankAccountNumber,
      bankUsername: w.recipientName?.replace(/\s+/g, ""),
      orderAmount: amountValue.toFixed(2),
      callback: CALLBACK_URL,
      timestamp,
    };

    // ✅ Format & sign the parameters
    const source = TopPaySignUtil.paramFormat(requestParams); // returns query string
    const sign = TopPaySignUtil.sign(MCH_PRIVATE_KEY, source); // pass string, not object
    requestParams.sign = sign;

    writeLog("withdraw", req, { signedParams: requestParams });

    // ✅ Send POST request
    const responseJson = await TopPaySignUtil.doPost(REQ_URL, JSON.stringify(requestParams));

    // ✅ Log & parse response
    writeLog("withdraw", req, { responseJson });

    const parsedResponse =
      typeof responseJson === "string" ? JSON.parse(responseJson) : responseJson;

    if (!parsedResponse || parsedResponse.code !== 0) {
      return res.json({
        success: false,
        error: parsedResponse?.message || "Withdraw request failed",
        details: parsedResponse,
      });
    }

    // ✅ Mark as processing in your DB
    await connection.query("UPDATE withdraw SET Processing_in_top = 1 WHERE id = ?", [id]);

    const finalResponse = {
      success: true,
      message: "Withdraw request sent successfully to TopPay",
      platformOrder: parsedResponse?.data?.platOrderNum,
      details: parsedResponse,
    };

    writeLog("withdraw", req, finalResponse);
    return res.json(finalResponse);
  } catch (error) {
    writeLog("withdraw_error", req, {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      error: error.message || "Withdraw processing failed",
    });
  }
};


export const withdrawaltoppaynotify = async (req, res) => {
  const GATEWAY_STATUS = {
    SUCCESS_1: 30,
    SUCCESS_2: 40,
    FAILED: 50,
    PENDING: 10,
  };

  try {
    const body = req.body || {};
    const orderNum = body.orderNum || null;
    const statusFromGateway = parseInt(body.status || 0);

    if (!orderNum) {
      return res.status(400).json({
        success: false,
        message: "Missing order number in request body.",
      });
    }

    // Log request
    await writeLog("WITHDRAW_NOTIFY", req, {
      receivedOrder: orderNum,
      statusFromGateway,
    });

    // Fetch withdrawal record
    const [withdrawalList] = await connection.query(
      "SELECT * FROM withdraw WHERE id_order = ? LIMIT 1",
      [orderNum]
    );

    if (!withdrawalList || withdrawalList.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Withdrawal record not found.",
      });
    }

    const withdrawal = withdrawalList[0];
    const { id, status: currentStatus } = withdrawal;

    // SUCCESS for both 30 and 40
    const isSuccess =
      statusFromGateway === GATEWAY_STATUS.SUCCESS_1 ||
      statusFromGateway === GATEWAY_STATUS.SUCCESS_2;

    // Prevent duplicate updates
    if (currentStatus === 1 && isSuccess) {
      return res.status(200).json({
        success: true,
        message: "Already approved. No update needed.",
      });
    }

    if (currentStatus === 2 && statusFromGateway === GATEWAY_STATUS.FAILED) {
      return res.status(200).json({
        success: true,
        message: "Already marked as failed.",
      });
    }

    if (currentStatus === 0 && statusFromGateway === GATEWAY_STATUS.PENDING) {
      return res.status(200).json({
        success: true,
        message: "Already pending.",
      });
    }

    // Update ONLY status & remarks (no utr, no amounts)
    if (isSuccess) {
      await connection.execute(
        `
        UPDATE withdraw 
        SET status = ?, remarks = ?
        WHERE id = ?
        `,
        [1, "Withdrawal approved by gateway", id]
      );
    } 
    else if (statusFromGateway === GATEWAY_STATUS.FAILED) {
      await connection.execute(
        `
        UPDATE withdraw 
        SET status = ?, remarks = ?
        WHERE id = ?
        `,
        [2, "Withdrawal failed by gateway", id]
      );
    } 
    else if (statusFromGateway === GATEWAY_STATUS.PENDING) {
      await connection.execute(
        `
        UPDATE withdraw 
        SET status = ?, remarks = ?
        WHERE id = ?
        `,
        [0, "Withdrawal pending at gateway", id]
      );
    }

    res.status(200).json({
      success: true,
      message: "Withdrawal notification processed successfully.",
    });

  } catch (error) {
    await writeLog("WITHDRAW_NOTIFY_ERROR", req, { error: error.message });

    return res.status(500).json({
      success: false,
      message: "Failed to process notification.",
      error: error.message,
    });
  }
};







const withdrawalController = {
  addBankCard,
  getBankCardInfo,
  addUSDTAddress,
  getUSDTAddressInfo,
  createWithdrawalRequest,
  listWithdrawalRequests,
  listWithdrawalHistory,
  approveOrDenyWithdrawalRequest,
  addBankCardPage,
  addUSDTAddressPage,
  sendToLGPay,
  selectBankPage,
  withdrawaltoppaynotify,
};

export default withdrawalController;

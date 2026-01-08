const UserWallet = require("../models/user.wallets");
const User = require("../models/user.models");
const sendEmail = require("../config/email");
const Wallet = require("../models/user.wallets");
const mongoose = require("mongoose");

// Create Wallet
const createWallet = async (req, res) => {
  try {
    const { userId } = req.user;
    const { phoneNumber, currency } = req.body;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove +234 or leading 0 from phone number
    const normalizedPhone = phoneNumber.replace(/^(\+234|0)/, "");

    existingUser.phoneNumber = phoneNumber;
    await existingUser.save();

    const newWallet = new UserWallet({
      userId: userId,
      balance: 0,
      currency: currency,
      accountNumber: normalizedPhone,
    });

    await newWallet.save();
    return res
      .status(201)
      .json({ message: "Wallet created successfully", wallet: newWallet });
  } catch (e) {
    console.error("Error creating wallet:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get All User Wallets
const getAllWallets = async (req, res) => {
  try {
    const { userId } = req.user;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const wallets = await UserWallet.find().populate(
      "userId",
      "email"
    );
    return res.status(200).json({ wallets });
  } catch (e) {
    console.error("Error fetching wallets:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};


// Transer Funds Between Wallets (Safe without Replica Set)
const transferFunds = async (req, res) => {
  const { accountNumberFrom, accountNumberTo, amount } = req.body;
  const { userId } = req.user;

  if (!userId) {
    return res.status(400).json({ message: "User Must Be Logged In" });
  }

  if (!accountNumberFrom || !accountNumberTo || !amount) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (amount <= 0) {
    return res.status(400).json({ message: "Amount must be greater than zero" });
  }

  if (accountNumberFrom === accountNumberTo) {
    return res.status(400).json({ message: "Cannot transfer to the same account" });
  }

  try {
    // Step 1: Check if both wallets exist
    const senderWallet = await Wallet.findOne({ accountNumber: accountNumberFrom });
    const receiverWallet = await Wallet.findOne({ accountNumber: accountNumberTo });

    if (!senderWallet) {
      return res.status(404).json({ message: "Sender wallet not found" });
    }

    if (!receiverWallet) {
      return res.status(404).json({ message: "Receiver wallet not found" });
    }

    if (senderWallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient funds" });
    }

    // Step 2: Atomic debit from sender (with balance check in query)
    // This ensures we only debit if balance is STILL sufficient
    const debitResult = await Wallet.findOneAndUpdate(
      { 
        accountNumber: accountNumberFrom,
        balance: { $gte: amount }  // Only update if balance is enough (prevents race condition)
      },
      { $inc: { balance: -amount } },
      { new: true }
    );

    // If debit failed (someone else spent the money first!)
    if (!debitResult) {
      return res.status(400).json({ message: "Insufficient funds or wallet changed" });
    }

    // Step 3: Credit receiver (this should always succeed)
    const creditResult = await Wallet.findOneAndUpdate(
      { accountNumber: accountNumberTo },
      { $inc: { balance: amount } },
      { new: true }
    );

    // If credit somehow failed, refund the sender (rollback manually)
    if (!creditResult) {
      await Wallet.updateOne(
        { accountNumber: accountNumberFrom },
        { $inc: { balance: amount } }  // Refund
      );
      return res.status(500).json({ message: "Transfer failed, funds returned" });
    }

    return res.status(200).json({ 
      message: "Transfer successful",
      details: {
        from: accountNumberFrom,
        to: accountNumberTo,
        amount: amount
      }
    });

  } catch (e) {
    console.error("Error during fund transfer:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  createWallet,
  getAllWallets,
  transferFunds,
};

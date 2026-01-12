const UserWallet = require("../models/user.wallets");
const User = require("../models/user.models");
const sendEmail = require("../config/email");
const Wallet = require("../models/user.wallets");
const mongoose = require("mongoose");
const Flutterwave = require("flutterwave-node-v3");
const axios = require("axios");

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

    const wallets = await UserWallet.find().populate("userId", "email");
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
    return res
      .status(400)
      .json({ message: "Amount must be greater than zero" });
  }

  if (accountNumberFrom === accountNumberTo) {
    return res
      .status(400)
      .json({ message: "Cannot transfer to the same account" });
  }

  try {
    // Step 1: Check if both wallets exist
    const senderWallet = await Wallet.findOne({
      accountNumber: accountNumberFrom,
    });
    const receiverWallet = await Wallet.findOne({
      accountNumber: accountNumberTo,
    });

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
        balance: { $gte: amount }, // Only update if balance is enough (prevents race condition)
      },
      { $inc: { balance: -amount } },
      { new: true }
    );

    // If debit failed (someone else spent the money first!)
    if (!debitResult) {
      return res
        .status(400)
        .json({ message: "Insufficient funds or wallet changed" });
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
        { $inc: { balance: amount } } // Refund
      );
      return res
        .status(500)
        .json({ message: "Transfer failed, funds returned" });
    }

    return res.status(200).json({
      message: "Transfer successful",
      details: {
        from: accountNumberFrom,
        to: accountNumberTo,
        amount: amount,
      },
    });
  } catch (e) {
    console.error("Error during fund transfer:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Create Redirect Url With Flutterwave
const createRedirectUrl = async (req, res) => {
  try {
    const { userId } = req.user;
    const { amount, currency, redirectUrl } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!amount || !currency || !redirectUrl) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Get user details for the payment
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a unique transaction reference
    const txRef = `TX-${Date.now()}-${userId}`;

    // Initialize Flutterwave
    const flw = new Flutterwave(
      process.env.FLW_PUBLIC_KEY,
      process.env.FLW_SECRET_KEY
    );

    // Create payment payload for Flutterwave Standard
    const payload = {
      tx_ref: txRef,
      amount: amount,
      currency: currency,
      redirect_url: redirectUrl,
      customer: {
        email: user.email,
        phonenumber: user.phoneNumber,
        name: user.name,
      },
      customizations: {
        title: "Wallet Funding",
        description: "Fund your wallet",
      },
    };

    // Generate hosted payment link using Flutterwave Standard API
    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(201).json({
      message: "Payment link created successfully",
      paymentLink: response.data.data.link,
      txRef: txRef,
    });
  } catch (e) {
    console.error("Error creating redirect URL:", e);
    return res
      .status(500)
      .json({ message: "Internal server error", error: e.message });
  }
};

// Flutterwave Webhook Handler
const flutterwaveWebhook = async (req, res) => {
  try {
    // Verify the webhook signature
    const secretHash = process.env.FLW_SECRET_HASH;
    const signature = req.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
      console.log("Invalid webhook signature");
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payload = req.body;

    // Check if payment was successful
    if (payload.status === "successful" && payload.event === "charge.completed") {
      const { tx_ref, amount, currency, id: transactionId } = payload.data;

      // Verify the transaction with Flutterwave
      const verifyResponse = await axios.get(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          },
        }
      );

      const verifyData = verifyResponse.data;

      if (
        verifyData.status === "success" &&
        verifyData.data.status === "successful" &&
        verifyData.data.amount === amount &&
        verifyData.data.currency === currency
      ) {
        // Extract userId from tx_ref (format: TX-timestamp-userId)
        const txParts = tx_ref.split("-");
        const userId = txParts[txParts.length - 1];

        // Find user's wallet and credit it
        const wallet = await Wallet.findOne({ userId: userId });

        if (wallet) {
          // Credit the wallet
          await Wallet.findOneAndUpdate(
            { userId: userId },
            { $inc: { balance: amount } },
            { new: true }
          );

          // Get user for email notification
          const user = await User.findById(userId);

          if (user) {
            // Send success email (optional)
            console.log(`Wallet funded successfully for user: ${user.email}, Amount: ${amount} ${currency}`);
          }

          return res.status(200).json({ message: "Wallet funded successfully" });
        } else {
          console.error("Wallet not found for userId:", userId);
          return res.status(404).json({ message: "Wallet not found" });
        }
      } else {
        console.error("Transaction verification failed", verifyData);
        return res.status(400).json({ message: "Transaction verification failed" });
      }
    }

    // For other events, just acknowledge receipt
    return res.status(200).json({ message: "Webhook received" });
  } catch (e) {
    console.error("Webhook error:", e);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};

module.exports = {
  createWallet,
  getAllWallets,
  transferFunds,
  createRedirectUrl,
  flutterwaveWebhook,
};

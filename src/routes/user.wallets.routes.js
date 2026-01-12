const routes = require('express').Router();
const { createWallet, getAllWallets, transferFunds, createRedirectUrl, flutterwaveWebhook } = require('../controller/user.wallets');
const isAuth = require('../config/auth');
const router = require('./user.routes');

routes.post('/create-wallet', isAuth, createWallet);
routes.get('/get-all-wallets', isAuth, getAllWallets);
routes.post('/transfer-funds', isAuth, transferFunds);
routes.post('/create-payment-link', isAuth, createRedirectUrl);

// Flutterwave webhook - no auth required (Flutterwave sends this)
routes.post('/webhook/flutterwave', flutterwaveWebhook);

module.exports = routes;
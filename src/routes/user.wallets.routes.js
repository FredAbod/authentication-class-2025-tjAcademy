const routes = require('express').Router();
const { createWallet, getAllWallets, transferFunds } = require('../controller/user.wallets');
const isAuth = require('../config/auth');
const router = require('./user.routes');

routes.post('/create-wallet', isAuth, createWallet);
routes.get('/get-all-wallets', isAuth, getAllWallets);
routes.post('/transfer-funds', isAuth, transferFunds);

module.exports = routes;
const express = require("express");
const { PAYMENT_PROVIDER } = require("../config/payments");

const router = express.Router();

router.get("/health", (req, res) => res.json({ ok: true, provider: PAYMENT_PROVIDER }));

module.exports = router;

import express from "express";

import { shiprocketWebhook } from "../controllers/shipping.controller.js";

const router = express.Router();

/**
 * Shiprocket calls this server-to-server with the token set in its
 * panel. Note Shiprocket rejects webhook URLs containing the words
 * "shiprocket", "kartrocket", "sr" or "kr", hence the neutral path:
 * register https://<host>/api/shipping/webhook
 */
router.post("/webhook", shiprocketWebhook);

export default router;

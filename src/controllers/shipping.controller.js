import { handleShiprocketWebhookService } from "../services/shipping.service.js";

/**
 * Shiprocket retries anything that is not a 2xx, so a processing
 * failure is logged and acknowledged. A bad token is the one case
 * that must fail loudly.
 */
export const shiprocketWebhook = async (req, res) => {
    try {
        const result = await handleShiprocketWebhookService({
            token: req.headers["x-api-key"],
            body: req.body
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        if (error.statusCode === 401 || error.statusCode === 503) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        console.error("Shiprocket webhook error:", error);

        return res.status(200).json({
            success: false,
            message: "Webhook received but not processed"
        });
    }
};

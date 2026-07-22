import cron from "node-cron";
import Order from "../models/Order.js";

/**
 * CRON Job to clean up expired orders
 * Runs every hour to mark orders that have been stuck in 'Pending' payment status
 * for more than 2 hours as 'Failed'.
 */
export const initOrderCleanupCron = () => {
  console.log("🧹 Order cleanup cron initialized.");
  // Runs every hour at minute 0 (0 * * * *)
  cron.schedule("0 * * * *", async () => {
    console.log("⏰ Running Expired Order Cleanup CRON Job...");

    try {
      // Define your expiration window (e.g., 2 hours ago)
      const expirationThreshold = new Date();
      expirationThreshold.setHours(expirationThreshold.getHours() -  2);

      // Find and update all orders matching the criteria
      const result = await Order.updateMany(
        {
          "payment.status": "Pending",
          createdAt: { $lt: expirationThreshold },
        },
        {
          $set: {
            "payment.status": "Failed",
            "payment.failureReason":
              "Payment session timed out / order expired",
          },
        },
      );

      if (result.modifiedCount > 0) {
        console.log(
          `✅ Cleaned up ${result.modifiedCount} expired pending orders.`,
        );
      } else {
        console.log("ℹ️ No expired pending orders found.");
      }
    } catch (error) {
      console.error(
        "❌ Error running Expired Order Cleanup CRON Job:",
        error.message,
      );
    }
  });
};

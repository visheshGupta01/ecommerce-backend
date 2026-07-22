import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initOrderCleanupCron } from "./utils/orderCleanup.cron.js";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();

    initOrderCleanupCron();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();

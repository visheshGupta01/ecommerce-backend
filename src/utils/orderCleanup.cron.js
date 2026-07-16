import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initOrderCleanupCron } from "./cron/orderCleanup.cron.js"; // 1. Import the cron utility

const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Initialize CRON Jobs
initOrderCleanupCron(); // 2. Start the cron job scheduler

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

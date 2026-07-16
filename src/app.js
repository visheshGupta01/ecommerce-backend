import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/auth.routes.js"
import productRoutes from "./routes/product.routes.js"
import cartRoutes from "./routes/cart.routes.js"
import orderRoutes from "./routes/order.routes.js"
import categoryRoutes from "./routes/category.routes.js"
import adminRoutes from "./routes/admin.routes.js"
import userRoutes from "./routes/user.routes.js"
import paymentRoutes from "./routes/payment.routes.js"
import shipmentRoutes from "./routes/shipment.routes.js"
import { razorpayWebhook } from "./controllers/payment.controller.js";


const app = express();

app.use(cors());

app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

app.use(express.json());
app.use(helmet());
app.use(morgan("dev"));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API Running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/product", productRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/category", categoryRoutes)
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/payment", paymentRoutes)
app.use("/api/shipment", shipmentRoutes)


export default app;

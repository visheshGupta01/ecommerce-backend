import Cart from "../models/Cart.js";
import Order from "../models/Order.js";

import {
  prepareOrderData,
  createPendingOrder,
  completeOrder,
} from "../services/order.service.js";

import {
  createRazorpayOrder,
  verifySignature,
  verifyRazorpayPayment,
  verifyWebhookSignature,
} from "../services/payment.service.js";

export const createPaymentOrder = async (req, res) => {
  try {
    const { shippingAddress } = req.body;

    console.log(req.body);
    console.log(req.body.shippingAddress);

    const { orderData, pricing } = await prepareOrderData({
      userId: req.user._id,
      shippingAddress,
    });

    console.log(orderData)

    const razorpayOrder = await createRazorpayOrder({
      amount: pricing.total,
      receipt: orderData.orderNumber,
    });

    console.log(razorpayOrder)

    const order = await createPendingOrder({
      orderData,
      payment: {
        provider: "razorpay",
        status: "Pending",
        razorpayOrderId: razorpayOrder.id,
      },
    });

    console.log(order)

    return res.status(200).json({
      success: true,

      payment: {
        key: process.env.RAZORPAY_KEY_ID,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },

      order,
    });
  } catch (error) {
    const validationErrors = [
      "Cart is empty",
      "Shipping address is incomplete",
      "One or more products no longer exist",
    ];

    if (
      validationErrors.includes(error.message) ||
      error.message.includes("items in stock")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

import crypto from "crypto";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import { completeOrder } from "../services/order.service.js";
import razorpayInstance from "../config/razorpay.js"; // Assuming your configuration exports the instance

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // 1. Find the internal order using the atomic lifecycle status check
    const order = await Order.findOneAndUpdate(
      {
        "payment.razorpayOrderId": razorpay_order_id,
        "payment.status": "Pending",
      },
      { $set: { "payment.status": "Verifying" } },
      { new: false }, // Returns the document BEFORE update so we can reference its initial status
    );

    if (!order) {
      return res.status(400).json({
        success: false,
        message: "Order not found or already processed",
      });
    }

    // 2. Cryptographic Signature Verification
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature !== expectedSign) {
      order.payment.status = "Failed";
      order.payment.failureReason = "Signature verification failed";
      await order.save();
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature" });
    }

    // 3. SECURE PARAMETER VERIFICATION VIA RAZORPAY API Fetch
    // We fetch the server-to-server transaction context directly from Razorpay's API
    const razorpayOrderFetch =
      await razorpayInstance.orders.fetch(razorpay_order_id);

    // Verify order id match (Implicitly handled by fetch, but good explicitly checking properties)
    if (razorpayOrderFetch.id !== order.payment.razorpayOrderId) {
      order.payment.status = "Failed";
      order.payment.failureReason = "Razorpay Order ID mismatch";
      await order.save();
      return res
        .status(400)
        .json({ success: false, message: "Tampered Order ID token" });
    }

    // Verify Currency matches INR
    if (razorpayOrderFetch.currency !== "INR") {
      order.payment.status = "Failed";
      order.payment.failureReason = `Invalid currency context: expected INR, received ${razorpayOrderFetch.currency}`;
      await order.save();
      return res
        .status(400)
        .json({
          success: false,
          message: "Only INR transactions are authorized",
        });
    }

    // Verify Amount (Note: Razorpay amounts are integer subunits/paise, so multiply total by 100)
    const expectedAmountPaise = Math.round(order.pricing.total * 100);
    if (razorpayOrderFetch.amount !== expectedAmountPaise) {
      order.payment.status = "Failed";
      order.payment.failureReason = `Amount tampering detected: expected ${expectedAmountPaise} paise, received ${razorpayOrderFetch.amount} paise`;
      await order.save();
      return res
        .status(400)
        .json({
          success: false,
          message: "Transaction total matching evaluation failed",
        });
    }

    // 4. Retrieve User Cart to pass forward
    const cart = await Cart.findOne({ user: order.user });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    // 5. Complete Order via isolated transaction layer (Using snapshot pattern)
    const completedOrder = await completeOrder({
      order,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      order: completedOrder,
    });
  } catch (error) {
    console.error("Payment Verification Exception:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const razorpayWebhook = async (req, res) => {
  try {
    if (
      !verifyWebhookSignature(req.body, req.headers["x-razorpay-signature"])
    ) {
      return res.sendStatus(400);
    }

    const event = JSON.parse(req.body.toString());

    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;

        // Atomically claim the order
        const order = await Order.findOneAndUpdate(
          {
            "payment.razorpayOrderId": payment.order_id,
            "payment.status": "Pending",
          },
          {
            $set: {
              "payment.status": "Verifying",
            },
          },
          {
            new: false,
          },
        );

        // Already processed, doesn't exist, or currently being verified
        if (!order) {
          return res.sendStatus(200);
        }

        try {
          // Verify payment amount
          if (payment.amount !== Math.round(order.pricing.total * 100)) {
            throw new Error("Amount mismatch");
          }

          // Verify payment status
          if (payment.status !== "captured") {
            throw new Error(`Unexpected payment status: ${payment.status}`);
          }

          const cart = await Cart.findOne({
            user: order.user,
          }).populate("items.product");

          if (!cart) {
            throw new Error("Cart not found");
          }

          await completeOrder({
            order,
            cart,
            razorpayPaymentId: payment.id,
            razorpaySignature: null,
          });
        } catch (error) {
          await Order.updateOne(
            {
              _id: order._id,
            },
            {
              $set: {
                "payment.status": "Failed",
                "payment.failureReason": error.message,
              },
            },
          );

          console.error(error);
        }

        break;
      }

      case "payment.failed": {
        const payment = event.payload.payment.entity;

        await Order.updateOne(
          {
            "payment.razorpayOrderId": payment.order_id,
          },
          {
            $set: {
              "payment.status": "Failed",
              "payment.failureReason": payment.error_description,
            },
          },
        );

        break;
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error(error);
    return res.sendStatus(500);
  }
};
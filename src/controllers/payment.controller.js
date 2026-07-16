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

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details",
      });
    }

    const validSignature = verifySignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    if (!validSignature) {
      await Order.updateOne(
        {
          "payment.razorpayOrderId": razorpay_order_id,
        },
        {
          $set: {
            "payment.status": "Failed",
            "payment.failureReason": "Signature mismatch",
          },
        },
      );

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const order = await Order.findOneAndUpdate(
      {
        "payment.razorpayOrderId": razorpay_order_id,
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

    if (!order) {
      const existing = await Order.findOne({
        "payment.razorpayOrderId": razorpay_order_id,
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Payment already verified or being processed",
      });
    }

    try {
      const payment = await verifyRazorpayPayment({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        expectedAmount: order.pricing.total,
      });

      const cart = await Cart.findOne({
        user: order.user,
      }).populate("items.product");

      if (!cart) {
        throw new Error("Cart not found");
      }

      const completedOrder = await completeOrder({
        order,
        cart,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });

      return res.status(200).json({
        success: true,
        message: "Payment verified successfully",
        order: completedOrder,
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

      throw error;
    }
  } catch (error) {
    if (
      error.message === "Cart not found" ||
      error.message === "Amount mismatch" ||
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
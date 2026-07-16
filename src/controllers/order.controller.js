import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import { generateOrderNumber } from "../utils/orderNumber.js";
import mongoose from "mongoose";

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
    });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      query.user = req.user._id;
    }

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate("user", "name email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });

      if (!order) {
        throw new Error("Order not found");
      }

      return res.status(200).json({
        success: true,
        order,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllOrders = async (req, res) => {
  const orders = await Order.find().populate("user", "name email");
  return res.status(200).json({
    success: true,
    orders,
  });
};

// Replacement inside src/controllers/order.controller.js
export const updateOrderStatus = async (req, res) => {
  try {
    const { paymentStatus, shippingStatus } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Explicitly update only the underlying real properties
    if (paymentStatus) {
      const validPaymentStatuses = ["Pending", "Verifying", "Paid", "Failed", "Refund Pending", "Refunded"];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({ success: false, message: "Invalid payment status" });
      }
      order.payment.status = paymentStatus;
    }

    if (shippingStatus) {
      const validShippingStatuses = ["Pending", "Shipment Created", "Pickup Scheduled", "Picked Up", "In Transit", "Out For Delivery", "Delivered", "Cancelled", "Returned"];
      if (!validShippingStatuses.includes(shippingStatus)) {
        return res.status(400).json({ success: false, message: "Invalid shipping status" });
      }
      order.shipping.status = shippingStatus;
    }

    await order.save();
    return res.status(200).json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
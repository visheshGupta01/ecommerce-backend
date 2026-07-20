import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import {
  createShipment as createShipmentService,
  schedulePickup as schedulePickupService,
  trackShipment as trackShipmentService,
  cancelShipment as cancelShipmentService,
  calculateShippingRates,
} from "../services/shipment.service.js";

export const createShipment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("user", "name email");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (order.payment.status !== "Paid") {
      return res
        .status(400)
        .json({ success: false, message: "Only paid orders can be shipped" });
    }
    if (order.shipping.shipmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Shipment already created" });
    }

    const shipment = await createShipmentService(order);
    console.log(shipment)
    return res
      .status(201)
      .json({
        success: true,
        message: "Shipment created successfully",
        shipment,
      });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const schedulePickup = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (order.shipping.status === "Pickup Scheduled") {
      return res
        .status(200)
        .json({ success: true, message: "Pickup already scheduled" });
    }
    if (!order.shipping.shipmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Shipment has not been created" });
    }

    const pickup = await schedulePickupService(order.shipping.shipmentId);
    order.shipping.status = "Pickup Scheduled";
    await order.save();

    return res
      .status(200)
      .json({
        success: true,
        message: "Pickup scheduled successfully",
        pickup,
      });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const trackShipment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (!order.shipping.awbCode) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Tracking information not available",
        });
    }

    const tracking = await trackShipmentService(order.shipping.awbCode);

    // Extract state cleanly out of Shiprocket's tracking schema object layer
    const carrierStatus =
      tracking?.tracking_data?.shipment_track?.[0]?.current_status;

    if (carrierStatus) {
      // Map Shiprocket's status keywords directly back into your schema's enum constraints
      order.shipping.status = carrierStatus;
      await order.save();
    }

    return res.status(200).json({ success: true, tracking });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const cancelShipment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    if (order.shipping.status === "Cancelled") {
      return res
        .status(400)
        .json({ success: false, message: "Shipment already cancelled" });
    }
    if (!order.shipping.shipmentId) {
      return res
        .status(400)
        .json({ success: false, message: "Shipment has not been created" });
    }

    const response = await cancelShipmentService(order.shipping.shipmentId);
    order.shipping.status = "Cancelled";
    await order.save();

    return res
      .status(200)
      .json({
        success: true,
        message: "Shipment cancelled successfully",
        response,
      });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Endpoint processing dedicated on-demand cart shipping estimates
 */
export const calculateShipment = async (req, res) => {
  try {
    const { pincode } = req.body;
    if (!pincode) {
      return res
        .status(400)
        .json({ success: false, message: "Pincode parameter is missing" });
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate(
      "items.product",
    );
    if (!cart || cart.items.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Your active shopping cart is empty",
        });
    }

    const shippingRates = await calculateShippingRates({
      products: cart.items,
      destinationPincode: pincode,
    });

    return res.status(200).json({ success: true, shipping: shippingRates });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

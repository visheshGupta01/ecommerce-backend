import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { generateOrderNumber } from "../utils/orderNumber.js";
import { calculateShippingRates } from "./shipment.service.js";

export const prepareOrderData = async ({
  userId,
  shippingAddress,
  shipping = {},
}) => {
  console.log(shippingAddress);
  const cart = await Cart.findOne({
    user: userId,
  }).populate("items.product");

  if (!cart || cart.items.length === 0) {
    throw new Error("Cart is empty");
  }

  const { fullName, phone, address, city, state, pincode } = shippingAddress;

  if (!fullName || !phone || !address || !city || !state || !pincode) {
    throw new Error("Shipping address is incomplete");
  }

  let subtotal = 0;

  const orderItems = [];

  for (const item of cart.items) {
    const product = item.product;

    if (!product) {
      throw new Error("One or more products no longer exist");
    }

    if (item.quantity > product.stock) {
      throw new Error(
        `${product.name} has only ${product.stock} items in stock`,
      );
    }

    const price = product.discountPrice ?? product.price;

    subtotal += price * item.quantity;

    orderItems.push({
      product: product._id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      image: product.images?.[0]?.url,
      quantity: item.quantity,
      price,
    });
  }

  console.log(cart.items);

  const shippingDetails = await calculateShippingRates({
    products: cart.items,
    destinationPincode: shippingAddress.pincode,
  });

  console.log(shippingDetails);

  const shippingCost = shippingDetails.shippingCost;
  const tax = shipping.tax ?? 0;
  const discount = shipping.discount ?? 0;

  const pricing = {
    subtotal,
    shippingCost,
    tax,
    discount,
    total: subtotal + shippingCost + tax - discount,
  };

  return {
    cart,
    pricing,
    orderData: {
      user: userId,
      items: orderItems,
      shippingAddress,
      pricing,
      shipping: {
        ...shipping,
        provider: "shiprocket",
        courier: shippingDetails.courier,
        courierId: shippingDetails.courierId,
        estimatedDelivery: shippingDetails.estimatedDelivery,
        package: shippingDetails.package,
      },
      orderNumber: generateOrderNumber(),
    },
  };
};

export const createPendingOrder = async ({ orderData, payment }) => {
  const order = await Order.create({
    ...orderData,
    payment,
  });

  return order;
};

export const completeOrder = async ({
  order,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const session = await mongoose.startSession();

  try {
    let completedOrder;

    await session.withTransaction(async () => {
      // 1. Fetch the order within the session lock to secure a database row lock
      const freshOrder = await Order.findOne({
        _id: order._id,
        "payment.status": "Verifying",
      }).session(session);

      // Already completed or being processed concurrently by a webhook/redirect
      if (!freshOrder) {
        completedOrder = await Order.findById(order._id).session(session);
        return;
      }

      // 2. Perform ATOMIC stock updates using conditional filtering ($gte)
      // This is the core engine that blocks race conditions.
      const stockUpdates = freshOrder.items.map((item) => ({
        updateOne: {
          // The filter ensures the product exists AND has sufficient stock
          filter: {
            _id: item.product,
            stock: { $gte: item.quantity },
          },
          // Decrement the stock atomically
          update: {
            $inc: { stock: -item.quantity },
          },
        },
      }));

      const bulkWriteResult = await Product.bulkWrite(stockUpdates, {
        session,
      });

      // If the number of modified products doesn't match the order items count,
      // it means at least one product ran out of stock concurrently during processing.
      if (bulkWriteResult.modifiedCount !== freshOrder.items.length) {
        throw new Error(
          "One or more items became out of stock during payment completion.",
        );
      }

      // 3. Clear the user's shopping cart inside the transaction
      await Cart.findOneAndUpdate(
        { user: freshOrder.user },
        { $set: { items: [] } },
        { session },
      );

      // 4. Update payment parameters and transition state to Paid
      freshOrder.payment.status = "Paid";
      freshOrder.payment.razorpayPaymentId = razorpayPaymentId;
      freshOrder.payment.razorpaySignature = razorpaySignature;
      freshOrder.payment.paidAt = new Date();

      await freshOrder.save({ session });
      completedOrder = freshOrder;
    });

    // 5. Populate paths securely outside the core write window
    await completedOrder.populate([
      {
        path: "items.product",
        select: "name slug images price discountPrice",
      },
      {
        path: "user",
        select: "name email",
      },
    ]);

    return completedOrder;
  } catch (error) {
    // MongoDB withTransaction automatically aborts the transaction and rolls back stock updates if this throws
    throw error;
  } finally {
    await session.endSession();
  }
};
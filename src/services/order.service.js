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

  console.log(cart.items)

  const shippingDetails = await calculateShippingRates({
    products: cart.items,
    destinationPincode: shippingAddress.pincode,
  });

  console.log(shippingDetails)

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
  cart,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const session = await mongoose.startSession();

  try {
    let completedOrder;

    await session.withTransaction(async () => {
      // Atomically claim completion
      const freshOrder = await Order.findOneAndUpdate(
        {
          _id: order._id,
          "payment.status": "Verifying",
        },
        {
          new: true,
          session,
        },
      );

      // Already completed or another process is completing it
      if (!freshOrder) {
        completedOrder = await Order.findById(order._id).session(session);
        return;
      }

      for (const item of cart.items) {
        if (item.quantity > item.product.stock) {
          throw new Error(
            `${item.product.name} has only ${item.product.stock} items in stock`,
          );
        }
      }

      await Product.bulkWrite(
        cart.items.map((item) => ({
          updateOne: {
            filter: {
              _id: item.product._id,
            },
            update: {
              $inc: {
                stock: -item.quantity,
              },
            },
          },
        })),
        { session },
      );

      cart.items = [];
      await cart.save({ session });

      freshOrder.payment.status = "Paid";
      freshOrder.payment.razorpayPaymentId = razorpayPaymentId;
      freshOrder.payment.razorpaySignature = razorpaySignature;
      freshOrder.payment.paidAt = new Date();

      await freshOrder.save({ session });

      completedOrder = freshOrder;
    });

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
  } finally {
    await session.endSession();
  }
};

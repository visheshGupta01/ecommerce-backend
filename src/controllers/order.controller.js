import Product from "../models/Product.js";
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";

export const placeOrder = async (req, res) => {
  try {
    const cart = await Cart.findOne({
      user: req.user._id,
    }).populate("items.product");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    let totalAmount = 0;

    const orderItems = [];

      for (const item of cart.items) {
        if (!item.product) {
          return res.status(400).json({
            success: false,
            message: "One or more products no longer exist",
          });
        }
      if (item.quantity > item.product.stock) {
        return res.status(400).json({
          success: false,
          message: `${item.product.name} has only ${item.product.stock} items in stock`,
        });
        }
        
        totalAmount += item.product.price * item.quantity;

        orderItems.push({
          product: item.product._id,
          quantity: item.quantity,
          price: item.product.price,
        });
      }
      
      const orderNumber =
        "ORD-" + Date.now() + "-" + Math.floor(Math.random() * 1000);


    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      shippingAddress: req.body.shippingAddress,
        totalAmount,
      orderNumber
    });

    for (const item of cart.items) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: {
          stock: -item.quantity,
        },
      });
    }

    cart.items = [];
    await cart.save();

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
    }).populate("items.product");

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user")
      .populate("items.product");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllOrders = async (req, res) => {
  const orders = await Order.find().populate("user").populate("items.product");

  res.status(200).json({
    success: true,
    orders,
  });
};

export const updateOrderStatus = async (req, res) => {
  const { status } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: "Order not found",
    });
  }

  order.orderStatus = status;

  await order.save();

  res.status(200).json({
    success: true,
    order,
  });
};

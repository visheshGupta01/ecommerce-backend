import Product from "../models/Product.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Quote from "../models/Quote.js"; // Included new Quote model

export const getDashboard = async (req, res) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  try {
    const [
      totalProducts,
      activeProducts,
      outOfStockProducts,
      totalCategories,
      totalUsers,
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      totalQuotes,
      pendingQuotes,
      revenue,
      salesChart,
      topProducts,
      recentOrders,
    ] = await Promise.all([
      // 1. Product Counts
      Product.countDocuments(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ stock: 0 }),

      // 2. Category & User Counts
      Category.countDocuments(),
      User.countDocuments({ role: "customer" }),

      // 3. Order Breakdown Counts
      Order.countDocuments(),
      Order.countDocuments({ "shipping.status": "Pending" }),
      Order.countDocuments({ "shipping.status": "Processing" }),
      Order.countDocuments({ "shipping.status": "Shipped" }),
      Order.countDocuments({ "shipping.status": "Delivered" }),

      // 4. B2B Quote Metrics (New)
      Quote.countDocuments(),
      Quote.countDocuments({ status: "Pending" }),

      // 5. Total Revenue Aggregation
      Order.aggregate([
        {
          $match: {
            "payment.status": "Paid",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$pricing.total",
            },
          },
        },
      ]),

      // 6. Monthly Sales Chart Data
      Order.aggregate([
        {
          $match: {
            "payment.status": "Paid",
            createdAt: {
              $gte: sixMonthsAgo,
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            revenue: { $sum: "$pricing.total" },
            orders: { $sum: 1 },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            revenue: 1,
            orders: 1,
            month: {
              $arrayElemAt: [
                [
                  "",
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ],
                "$_id.month",
              ],
            },
          },
        },
      ]),

      // 7. Top Selling Products Aggregation
      Order.aggregate([
        {
          $match: {
            "payment.status": "Paid",
          },
        },
        {
          $unwind: "$items",
        },
        {
          $group: {
            _id: "$items.product",
            sold: {
              $sum: "$items.quantity",
            },
          },
        },
        {
          $sort: {
            sold: -1,
          },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $project: {
            _id: "$product._id",
            name: "$product.name",
            image: {
              $arrayElemAt: ["$product.images", 0],
            },
            sold: 1,
            price: {
              $ifNull: ["$product.discountPrice", "$product.price"],
            },
            slug: "$product.slug",
            sku: "$product.sku",
          },
        },
      ]),

      // 8. Recent Orders Overview List
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "name email")
        .select("orderNumber user pricing payment shipping createdAt")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      dashboard: {
        stats: {
          totalRevenue: revenue[0]?.totalRevenue || 0,
          totalOrders,
          totalUsers,
          totalProducts,
          activeProducts,
          outOfStockProducts,
          totalCategories,
          pendingOrders,
          processingOrders,
          shippedOrders,
          deliveredOrders,
          totalQuotes,
          pendingQuotes,
        },
        salesChart,
        topProducts,
        recentOrders,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
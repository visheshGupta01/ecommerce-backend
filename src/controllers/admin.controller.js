import Product from "../models/Product.js";
import Category from "../models/Category.js";
import User from "../models/User.js";
import Order from "../models/Order.js";

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
      revenue,
      salesChart,
      topProducts,
      recentOrders,
    ] = await Promise.all([
      Product.countDocuments(),

      Product.countDocuments({
        isActive: true,
      }),

      Product.countDocuments({
        stock: 0,
      }),

      Category.countDocuments(),

      User.countDocuments({
        role: "customer",
      }),

      Order.countDocuments(),

      // Total Revenue
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

      // Monthly Sales Chart
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
              year: {
                $year: "$createdAt",
              },
              month: {
                $month: "$createdAt",
              },
            },
            revenue: {
              $sum: "$pricing.total",
            },
            orders: {
              $sum: 1,
            },
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

      // Top Selling Products
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
              $arrayElemAt: ["$product.images.url", 0],
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

      // Recent Orders
      Order.find()
        .sort({
          createdAt: -1,
        })
        .limit(5)
        .populate("user", "name email")
        .select("orderNumber user pricing orderStatus createdAt")
        .lean(),
    ]);

    res.status(200).json({
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
        },

        salesChart,

        topProducts,

        recentOrders,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

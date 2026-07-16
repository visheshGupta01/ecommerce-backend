import Order from "../models/Order.js";
import User from "../models/User.js";

export const getAllUsers = async (req, res) => {
  try {
    const { keyword, role, isActive, page = 1, limit = 10 } = req.query;

    const query = {};

    if (keyword) {
      query.$or = [
        {
          name: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          email: {
            $regex: keyword,
            $options: "i",
          },
        },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    const totalUsers = await User.countDocuments(query);

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    const users = await User.aggregate([
      {
        $match: query,
      },
      {
        $lookup: {
          from: "orders",
          localField: "_id",
          foreignField: "user",
          as: "orders",
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          role: 1,
          isActive: 1,
          createdAt: 1,

          orderCount: {
            $size: "$orders",
          },

          totalSpending: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$orders",
                    as: "order",
                    cond: {
                      $eq: ["$$order.payment.status", "Paid"],
                    },
                  },
                },
                as: "paidOrder",
                in: "$$paidOrder.totalAmount",
              },
            },
          },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $skip: (page - 1) * limitNumber,
      },
      {
        $limit: limitNumber,
      },
    ]);
    res.status(200).json({
      success: true,

      pagination: {
        totalUsers,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalUsers / limitNumber),
        limit: limitNumber,
      },

      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const totalOrders = await Order.countDocuments({
      user: user._id,
    });

    const totalSpent = await Order.aggregate([
      {
        $match: {
          user: user._id,
          "payment.status": "Paid",
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: {
            $sum: "$pricing.total",
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,

      user: {
        ...user,

        stats: {
          totalOrders,
          totalSpent: totalSpent[0]?.totalSpent || 0,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, role, isActive } = req.body;

    const updates = {};

    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        isActive,
      },
      {
        new: true,
      },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role === "admin") {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be deactivated",
      });
    }

    user.isActive = false;

    await user.save();

    res.status(200).json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

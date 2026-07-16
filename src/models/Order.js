import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        // Snapshot of product at purchase time
        name: {
          type: String,
          required: true,
        },

        slug: String,

        sku: String,

        image: String,

        quantity: {
          type: Number,
          required: true,
        },

        price: {
          type: Number,
          required: true,
        },
      },
    ],

    shippingAddress: {
      fullName: {
        type: String,
        required: true,
      },

      phone: {
        type: String,
        required: true,
      },

      address: {
        type: String,
        required: true,
      },

      city: {
        type: String,
        required: true,
      },

      state: {
        type: String,
        required: true,
      },

      pincode: {
        type: String,
        required: true,
      },
    },

    pricing: {
      subtotal: {
        type: Number,
        required: true,
      },

      shippingCost: {
        type: Number,
        default: 0,
      },

      tax: {
        type: Number,
        default: 0,
      },

      discount: {
        type: Number,
        default: 0,
      },

      total: {
        type: Number,
        required: true,
      },
    },

    payment: {
      provider: {
        type: String,
        enum: ["razorpay", "cod"],
        default: "razorpay",
      },

      status: {
        type: String,
        enum: [
          "Pending",
          "Verifying",
          "Paid",
          "Failed",
          "Refund Pending",
          "Refunded",
        ],
        default: "Pending",
      },

      razorpayOrderId: String,

      razorpayPaymentId: String,

      razorpaySignature: String,

      paidAt: Date,

      failureReason: {
        type: String,
      },
    },

    shipping: {
      status: {
        type: String,
        enum: [
          "Pending",
          "Shipment Created",
          "Pickup Scheduled",
          "Picked Up",
          "In Transit",
          "Out For Delivery",
          "Delivered",
          "Cancelled",
          "Returned",
        ],
        default: "Pending",
      },
      provider: String,

      courier: String,

      courierId: Number,

      shipmentId: String,

      shiprocketOrderId: String,

      awbCode: String,

      trackingUrl: String,

      estimatedDelivery: String,

      package: {
        weight: Number,
        length: Number,
        breadth: Number,
        height: Number,
      },
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({
  "payment.razorpayOrderId": 1,
});

orderSchema.index({
  "payment.status": 1,
});

orderSchema.index({
  user: 1,
  createdAt: -1,
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

orderSchema.virtual("orderStatus").get(function () {
  const payment = this.payment.status;
  const shipping = this.shipping.status;

  if (payment === "Pending") {
    return "Awaiting Payment";
  }

  if (payment === "Verifying") {
    return "Verifying Payment";
  }

  if (payment === "Failed") {
    return "Payment Failed";
  }

  if (payment === "Refunded") {
    return "Refunded";
  }

  if (payment === "Refund Pending") {
    return "Refund Pending";
  }

  if (
    payment !== "Paid" &&
    payment !== "Refund Pending" &&
    payment !== "Refunded" &&
    shipping !== "Pending"
  ) {
    return "Invalid";
  }

  switch (shipping) {
    case "Pending":
      return "Preparing Shipment";

    case "Shipment Created":
      return "Shipment Created";

    case "Pickup Scheduled":
      return "Pickup Scheduled";

    case "Picked Up":
      return "Shipped";

    case "In Transit":
      return "In Transit";

    case "Out For Delivery":
      return "Out For Delivery";

    case "Delivered":
      return "Delivered";

    case "Cancelled":
      return "Cancelled";

    case "Returned":
      return "Returned";

    default:
      return "Processing";
  }
});

export default mongoose.model("Order", orderSchema);

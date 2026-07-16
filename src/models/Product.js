import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPrice: {
      type: Number,
      default: null,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    sku: {
      type: String,
      unique: true,
      sparse: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
    },

    brand: {
      type: String,
      trim: true,
      index: true,
    },

    shipping: {
      weight: {
        type: Number,
        required: true,
        min: 0,
        default: 0.5,
      },

      length: {
        type: Number,
        required: true,
        min: 0,
        default: 10,
      },

      breadth: {
        type: Number,
        required: true,
        min: 0,
        default: 10,
      },

      height: {
        type: Number,
        required: true,
        min: 0,
        default: 10,
      },

      hsnCode: {
        type: String,
        trim: true,
      },

      isShippable: {
        type: Boolean,
        default: true,
      },
    },

    images: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
        },
      },
    ],

    tags: {
      type: [String],
      default: [],
    },

    specifications: {
      type: Map,
      of: String,
      default: {},
    },

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({
  name: "text",
  description: "text",
  brand: "text",
});

productSchema.index({
  category: 1,
});

productSchema.index({
  subCategory: 1,
});

productSchema.index({
  price: 1,
});

productSchema.index({
  isFeatured: 1,
});

productSchema.index({
  isActive: 1,
});

productSchema.index({
  averageRating: -1,
});

export default mongoose.model("Product", productSchema);

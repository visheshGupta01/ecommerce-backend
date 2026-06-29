import mongoose from "mongoose";

const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    image: {
      url: String,
      public_id: String,
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

subCategorySchema.index(
  {
    category: 1,
    name: 1,
  },
  {
    unique: true,
  },
);
subCategorySchema.index(
  {
    category: 1,
    slug: 1,
  },
  {
    unique: true,
  },
);

export default mongoose.model("SubCategory", subCategorySchema);

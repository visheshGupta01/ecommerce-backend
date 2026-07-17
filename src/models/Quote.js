import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Responded", "Cancelled"],
      default: "Pending",
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
    },
    notes: {
      type: String,
      default: "",
    },
    fullName:{
      type: String,
      required: true
    },
    requirementType: {
      type: String,
      enum:["standard","bulk"],
      required: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Quote", quoteSchema);

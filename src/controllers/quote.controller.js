import Quote from "../models/Quote.js";
import Product from "../models/Product.js";

export const createQuoteRequest = async (req, res) => {
  try {
    const {
      productId,
      email,
      notes,
      fullName,
      phone,
      requirementType,
      companyName,
    } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const quote = await Quote.create({
      user: req.user._id,
      product: productId,
      email,
      notes: notes || `Bulk buy request for SKU ${product.sku}`,
      fullName,
      phone,
      requirementType,
      companyName,
    });

    return res.status(201).json({
      success: true,
      message: "Quotation request registered successfully",
      quote,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

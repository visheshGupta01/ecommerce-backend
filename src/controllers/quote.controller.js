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

export const getAllQuotes = async (req, res) => {
  try {
    const quotes = await Quote.find()
      .populate("product", "name sku price images")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, quotes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateQuoteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const quote = await Quote.findById(id);
    if (!quote) {
      return res.status(404).json({ success: false, message: "Quote not found" });
    }

    if (status) quote.status = status;
    if (adminNotes !== undefined) quote.adminNotes = adminNotes;

    await quote.save();

    return res.status(200).json({
      success: true,
      message: "Quote request status updated",
      quote,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
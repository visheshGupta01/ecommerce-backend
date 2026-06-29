import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "products",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

export const createProduct = async (req, res) => {
  try {
    const imageUrls = [];
    console.log(req.file);
    console.log(req.files);
    console.log(req.body);
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image",
      });
    }
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer);
      console.log(result);

      imageUrls.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
    }
    if (req.body.specifications) {
      req.body.specifications = JSON.parse(req.body.specifications);
    }

    const product = await Product.create({ ...req.body, images: imageUrls });

    res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const {
      keyword,
      category,
      brand,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sort = "-createdAt",
    } = req.query;

    const query = {};

    // Search
    if (keyword) {
      query.$or = [
        {
          name: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          description: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          brand: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          category: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          tags: {
            $in: [new RegExp(keyword, "i")],
          },
        },
      ];
    }

    // Category
    if (category) {
      query.category = category;
    }

    // Brand
    if (brand) {
      query.brand = brand;
    }

    // Price Range
    if (minPrice || maxPrice) {
      query.price = {};

      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Only active products
    query.isActive = true;

    const totalProducts = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate("category")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      success: true,

      pagination: {
        totalProducts,
        currentPage: Number(page),
        totalPages: Math.ceil(totalProducts / limit),
        limit: Number(limit),
      },

      products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    for (const image of product.images) {
      await cloudinary.uploader.destroy(image.public_id);
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

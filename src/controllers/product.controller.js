import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import { v2 as cloudinary } from "cloudinary";
import { generateUniqueSlug } from "../utils/slugGenerator.js";

export const createProduct = async (req, res) => {
  const uploadedImages = [];
  try {
    const imageUrls = [];
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one image",
      });
    }
    const categoryExists = await Category.findById(req.body.category);

    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer);

      imageUrls.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
      uploadedImages.push(result);
    }

    const slug = await generateUniqueSlug(req.body.name);

    if (req.body.specifications) {
      req.body.specifications = JSON.parse(req.body.specifications);
    }

    const product = await Product.create({
      ...req.body,
      slug: slug,
      images: imageUrls,
    });

    res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    for (const image of uploadedImages) {
      await cloudinary.uploader.destroy(image.public_id);
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllProducts = async (req, res) => {

  console.log(req)
  try {
    const {
      keyword,
      category,
      brand,
      minPrice,
      maxPrice,
      featured,
      inStock,
      page = 1,
      limit = 10,
      sort = "-createdAt",
      ...specificationFilters
    } = req.query;

    const query = {};

    for (const [key, value] of Object.entries(specificationFilters)) {
      const values = value.split(",");

      query[`specifications.${key}`] = {
        $in: values,
      };
    }

    // Search
    let categoryIds = [];

    if (keyword) {
      const matchedCategories = await Category.find({
        name: {
          $regex: keyword,
          $options: "i",
        },
      }).select("_id");

      categoryIds = matchedCategories.map((category) => category._id);

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
          sku: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          slug: {
            $regex: keyword,
            $options: "i",
          },
        },
        {
          tags: {
            $in: [new RegExp(keyword, "i")],
          },
        },
        ...(categoryIds.length
          ? [
              {
                category: {
                  $in: categoryIds,
                },
              },
            ]
          : []),
      ];
    }

    if (featured !== undefined) {
      query.isFeatured = featured === "true";
    }

    if (inStock === "true") {
      query.stock = { $gt: 0 };
    }

    // Category
    if (category) {
      query.category = category;
    }

    // Brand
    if (brand) {
      query.brand = {
        $in: brand.split(","),
      };
    }

    // Price Range
    if (minPrice || maxPrice) {
      query.price = {};

      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      rating: { averageRating: -1 },
      name_asc: { name: 1 },
      name_desc: { name: -1 },
    };

    // Only active products
    if (!req.user?.isAdmin) {
      query.isActive = true;
    }
    const sortQuery = sortOptions[sort] || sortOptions.newest;

    const totalProducts = await Product.countDocuments(query);

    const products = await Product.find(query)
      .populate("category")
      .populate("subCategory")
      .sort(sortQuery)
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const currentPage = Number(page);
    const totalPages = Math.ceil(totalProducts / limit);

    res.status(200).json({
      success: true,

      pagination: {
        totalProducts,
        currentPage: currentPage,
        totalPages: totalPages,
        limit: Number(limit),
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
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
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("subCategory");
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
  const uploadedImages = [];

  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Validate category
    if (req.body.category) {
      const categoryExists = await Category.findById(req.body.category);
      if (!categoryExists) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }
    }

    // Parse specifications
    if (req.body.specifications) {
      req.body.specifications =
        typeof req.body.specifications === "string"
          ? JSON.parse(req.body.specifications)
          : req.body.specifications;
    }

    // Reconstruct Nested Shipping Object from FormData
    if (req.body["shipping[isShippable]"] !== undefined || req.body.shipping) {
      const isShippable =
        req.body["shipping[isShippable]"] !== undefined
          ? req.body["shipping[isShippable]"] === "true"
          : (req.body.shipping?.isShippable ?? product.shipping?.isShippable);

      const weight = Number(
        req.body["shipping[package][weight]"] ||
          product.shipping?.package?.weight ||
          0.5,
      );
      const length = Number(
        req.body["shipping[package][length]"] ||
          product.shipping?.package?.length ||
          10,
      );
      const width = Number(
        req.body["shipping[package][width]"] ||
          product.shipping?.package?.width ||
          10,
      );
      const height = Number(
        req.body["shipping[package][height]"] ||
          product.shipping?.package?.height ||
          10,
      );

      req.body.shipping = {
        isShippable,
        weight,
        length,
        breadth,
        height,
      };

      delete req.body["shipping[isShippable]"];
      delete req.body["shipping[package][weight]"];
      delete req.body["shipping[package][length]"];
      delete req.body["shipping[package][width]"];
      delete req.body["shipping[package][height]"];
    }

    // Parse image removal list from req.body
    let removedImagePublicIds = [];
    if (req.body.removedImagePublicIds) {
      try {
        removedImagePublicIds =
          typeof req.body.removedImagePublicIds === "string"
            ? JSON.parse(req.body.removedImagePublicIds)
            : req.body.removedImagePublicIds;
      } catch (err) {
        removedImagePublicIds = [];
      }
      delete req.body.removedImagePublicIds;
    }

    // 1. Filter existing images (keep ones that were NOT marked for removal)
    let currentImages = (product.images || []).filter(
      (img) => !removedImagePublicIds.includes(img.public_id),
    );

    // 2. Upload and append new images if any are uploaded
    if (req.files && req.files.length > 0) {
      const newImages = [];
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer);
        uploadedImages.push(result);
        newImages.push({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
      currentImages = [...currentImages, ...newImages];
    }

    req.body.images = currentImages;

    // Generate new slug if name changed
    if (req.body.name && req.body.name !== product.name) {
      req.body.slug = await generateUniqueSlug(req.body.name);
    }

    Object.assign(product, req.body);
    await product.save();

    // 3. Delete ONLY the removed old images from Cloudinary after successful DB save
    for (const publicId of removedImagePublicIds) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (destroyError) {
        console.error("Cloudinary deletion warning:", destroyError.message);
      }
    }

    await product.populate([{ path: "category" }, { path: "subCategory" }]);

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.log(error.stack)
    // Roll back any newly uploaded images on error
    for (const image of uploadedImages) {
      if (image.public_id) {
        await cloudinary.uploader.destroy(image.public_id);
      }
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    for (const image of product.images) {
      await cloudinary.uploader.destroy(image.public_id);
    }

    await product.deleteOne();

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

export const getProductFilters = async (req, res) => {
  try {
    const [categories, brands, products, price] = await Promise.all([
      Category.find({ isActive: true }).select("name slug"),
      Product.distinct("brand"),
      Product.find({ isActive: true }).select("specifications"),
      Product.aggregate([
        {
          $match: {
            isActive: true,
          },
        },
        {
          $group: {
            _id: null,
            minPrice: {
              $min: "$price",
            },
            maxPrice: {
              $max: "$price",
            },
          },
        },
      ]),
    ]);

    const specificationFilters = {};

    for (const product of products) {
      if (!product.specifications) continue;

      for (const [key, value] of product.specifications.entries()) {
        if (!specificationFilters[key]) {
          specificationFilters[key] = new Set();
        }

        specificationFilters[key].add(value);
      }
    }

    Object.keys(specificationFilters).forEach((key) => {
      specificationFilters[key] = [...specificationFilters[key]].sort();
    });

    res.status(200).json({
      success: true,
      filters: {
        global: {
          categories,
          brands: brands.filter(Boolean).sort(),

          priceRange: {
            min: price[0]?.minPrice ?? 0,
            max: price[0]?.maxPrice ?? 0,
          },

          availability: [
            {
              label: "In Stock",
              value: true,
            },
          ],

          sortOptions: [
            {
              label: "Newest",
              value: "newest",
            },
            {
              label: "Oldest",
              value: "oldest",
            },
            {
              label: "Price: Low to High",
              value: "price_asc",
            },
            {
              label: "Price: High to Low",
              value: "price_desc",
            },
            {
              label: "Highest Rated",
              value: "rating",
            },
            {
              label: "Name A-Z",
              value: "name_asc",
            },
            {
              label: "Name Z-A",
              value: "name_desc",
            },
          ],
        },

        specifications: specificationFilters,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

import Category from "../models/Category.js";
import SubCategory from "../models/SubCategory.js";

export const createSubCategory = async (req, res) => {
  try {
    const { name, slug, category } = req.body;

    const categoryExists = await Category.findById(category);

    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const existingSubCategory = await SubCategory.findOne({
      category,
      $or: [{ name }, { slug }],
    });

    if (existingSubCategory) {
      return res.status(400).json({
        success: false,
        message: "Subcategory already exists",
      });
    }

    const subCategory = await SubCategory.create({
      ...req.body,
    });

    res.status(201).json({
      success: true,
      message: "Subcategory created successfully",
      subCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllSubCategories = async (req, res) => {
  try {
    const query = {
      isActive: true,
    };

    if (req.query.category) {
      query.category = req.query.category;
    }

    const subCategories = await SubCategory.find(query)
      .populate("category")
      .sort("name");

    res.status(200).json({
      success: true,
      count: subCategories.length,
      subCategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getSubCategoryById = async (req, res) => {
  try {
    const subCategory = await SubCategory.findById(req.params.id).populate(
      "category",
    );

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    res.status(200).json({
      success: true,
      subCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const updateSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Subcategory updated successfully",
      subCategory,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const deleteSubCategory = async (req, res) => {
  try {
    const subCategory = await SubCategory.findByIdAndUpdate(
      req.params.id,
      {
        isActive: false,
      },
      {
        new: true,
      },
    );

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "Subcategory not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Subcategory deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
import slugify from "slugify";
import Product from "../models/Product.js";

export const generateUniqueSlug = async (name) => {
  const baseSlug = slugify(name, {
    lower: true,
    strict: true,
  });

  let slug = baseSlug;
  let count = 1;

  while (await Product.exists({ slug })) {
    slug = `${baseSlug}-${count}`;
    count++;
  }

  return slug;
};

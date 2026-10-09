import { Router } from "express";

export default function createMenuRoutes(pool) {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const [cats] = await pool.query(
        "SELECT * FROM menu_categories WHERE is_active = 1 AND slug = 'breakfast' ORDER BY sort_order, category_id"
      );
      const [items] = await pool.query(
        "SELECT * FROM menu_items WHERE is_active = 1 ORDER BY sort_order, item_id"
      );

      const byCategory = {};
      for (const item of items) {
        (byCategory[item.category_id] ||= []).push({
          id: item.item_id,
          name: item.name,
          description: item.description || "",
          price: Number(item.price),
          image: item.image_url || "",
          tags: (item.tags || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean),
          signature: Boolean(item.is_signature),
          available: Boolean(item.is_available),
        });
      }

      const categories = cats
        .map((category) => ({
          id: category.category_id,
          slug: category.slug,
          name: category.name,
          description: category.description || "",
          hours: category.serving_hours || "",
          items: byCategory[category.category_id] || [],
        }))
        .filter((category) => category.items.length > 0);

      res.json({ categories });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

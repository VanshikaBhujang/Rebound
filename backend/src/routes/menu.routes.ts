import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get all menu items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(menuItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
// Create a single menu item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, price, category } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ error: 'name, price, and category are required' });
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        price: parseFloat(price),
        category
      }
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create multiple menu items (Bulk)
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'An array of items is required' });
    }

    const created = await prisma.menuItem.createMany({
      data: items.map((i: any) => ({
        name: i.name,
        price: parseFloat(i.price),
        category: i.category
      })),
      skipDuplicates: true
    });

    res.status(201).json({ count: created.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a menu item (Name, Price, Category)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const { name, price, category } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const existing = await prisma.menuItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        name: name.trim(),
        price: parseFloat(price),
        ...(category ? { category: category.trim() } : {})
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a menu item (only if not used in orders)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const existing = await prisma.menuItem.findUnique({
      where: { id },
      include: { orders: { take: 1 } }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    if (existing.orders.length > 0) {
      return res.status(400).json({
        error: 'Cannot delete this item because it has existing order records in past sessions.'
      });
    }

    await prisma.menuItem.delete({ where: { id } });
    res.json({ message: `Menu item "${existing.name}" deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

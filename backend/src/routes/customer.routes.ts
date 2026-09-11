import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Helper: sync existing unique customers from Sessions into Customer table if empty
async function ensureCustomersSynced() {
  try {
    const count = await prisma.customer.count();
    if (count === 0) {
      // Find all unique customers with phone numbers from past sessions
      const sessions = await prisma.session.findMany({
        where: {
          customerPhone: { not: null },
          customerName: { not: 'Guest' }
        },
        select: {
          customerName: true,
          customerPhone: true,
          startTime: true
        },
        orderBy: { startTime: 'desc' }
      });

      const uniquePhoneMap = new Map<string, { name: string; phone: string }>();
      for (const s of sessions) {
        const phone = s.customerPhone ? s.customerPhone.trim() : '';
        const name = s.customerName ? s.customerName.trim() : '';
        if (phone && name && !uniquePhoneMap.has(phone)) {
          uniquePhoneMap.set(phone, { name, phone });
        }
      }

      for (const [phone, item] of uniquePhoneMap.entries()) {
        const parts = item.name.split(' ');
        const firstName = parts[0] || item.name;
        const lastName = parts.slice(1).join(' ') || '';
        await prisma.customer.upsert({
          where: { phone },
          update: {},
          create: {
            firstName,
            lastName,
            name: item.name,
            phone
          }
        });
      }
    }
  } catch (err) {
    console.error('Customer initial sync warning:', err);
  }
}

// 1. GET /api/customers - Search customers by name, surname, or phone
router.get('/', authenticateToken, async (req, res) => {
  try {
    await ensureCustomersSynced();

    const search = ((req.query.search as string) || '').trim();

    let whereClause: any = {};
    if (search) {
      const tokens = search.split(/\s+/).filter(Boolean);
      whereClause = {
        AND: tokens.map((tok) => ({
          OR: [
            { firstName: { contains: tok, mode: 'insensitive' } },
            { lastName: { contains: tok, mode: 'insensitive' } },
            { name: { contains: tok, mode: 'insensitive' } },
            { phone: { contains: tok } }
          ]
        }))
      };
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      orderBy: { name: 'asc' },
      take: 50
    });

    res.json(customers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/customers/:phone/payments - Get last 3-4 payments with dates for a customer
router.get('/:phone/payments', authenticateToken, async (req, res) => {
  try {
    const phone = req.params.phone.trim();

    const payments = await prisma.payment.findMany({
      where: {
        session: {
          customerPhone: phone
        }
      },
      include: {
        session: {
          select: {
            id: true,
            customerName: true,
            status: true,
            totalBill: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 4
    });

    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. POST /api/customers - Add a new customer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: 'First name is required' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const cleanPhone = phone.trim();
    const cleanFirst = firstName.trim();
    const cleanLast = (lastName || '').trim();
    const fullName = (cleanFirst + ' ' + cleanLast).trim();

    const existing = await prisma.customer.findUnique({
      where: { phone: cleanPhone }
    });

    if (existing) {
      return res.status(400).json({ error: `Customer with phone ${cleanPhone} already exists (${existing.name})` });
    }

    const customer = await prisma.customer.create({
      data: {
        firstName: cleanFirst,
        lastName: cleanLast,
        name: fullName,
        phone: cleanPhone
      }
    });

    res.status(201).json(customer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. PUT /api/customers/:phone - Edit First Name and Surname (Phone is strictly immutable)
router.put('/:phone', authenticateToken, async (req, res) => {
  try {
    const phone = req.params.phone.trim();
    const { firstName, lastName } = req.body;

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ error: 'First name is required' });
    }

    const existing = await prisma.customer.findUnique({
      where: { phone }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const cleanFirst = firstName.trim();
    const cleanLast = (lastName || '').trim();
    const newFullName = (cleanFirst + ' ' + cleanLast).trim();
    const oldName = existing.name;

    // 1. Update Customer record
    const updatedCustomer = await prisma.customer.update({
      where: { phone },
      data: {
        firstName: cleanFirst,
        lastName: cleanLast,
        name: newFullName
      }
    });

    // 2. Cascade updated name to past sessions for this phone
    await prisma.session.updateMany({
      where: { customerPhone: phone },
      data: { customerName: newFullName }
    });

    // 3. Cascade updated name to udhars matching oldName
    if (oldName && oldName !== newFullName) {
      await prisma.udhar.updateMany({
        where: { customerName: { equals: oldName, mode: 'insensitive' } },
        data: { customerName: newFullName }
      });
    }

    res.json(updatedCustomer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper: Check customer deletion eligibility
async function checkCustomerDeletionEligibility(phone: string, customerName: string) {
  const activeSession = await prisma.session.findFirst({
    where: {
      status: 'active',
      OR: [
        { customerPhone: phone },
        { customerName: { equals: customerName, mode: 'insensitive' } }
      ]
    },
    include: {
      table: {
        select: { id: true, number: true, gameType: true }
      }
    }
  });

  const unpaidUdhars = await prisma.udhar.findMany({
    where: {
      status: 'unpaid',
      OR: [
        { customerName: { equals: customerName, mode: 'insensitive' } },
        { session: { customerPhone: phone } }
      ]
    },
    select: {
      id: true,
      amount: true,
      createdAt: true
    }
  });

  const totalUdhar = unpaidUdhars.reduce((sum, u) => sum + (u.amount || 0), 0);
  const hasActiveSession = !!activeSession;
  const hasUdhar = unpaidUdhars.length > 0;
  const canDelete = !hasActiveSession && !hasUdhar;

  const reasons: string[] = [];
  let tableName = 'Active Table';
  if (activeSession) {
    if (activeSession.table) {
      tableName = `${activeSession.table.gameType} #${activeSession.table.number}`;
    }
    reasons.push(`Active session in progress on ${tableName}`);
  }
  if (hasUdhar) {
    reasons.push(`Unpaid udhar of ₹${totalUdhar}`);
  }

  return {
    canDelete,
    hasActiveSession,
    activeSession: activeSession ? {
      id: activeSession.id,
      tableName
    } : null,
    hasUdhar,
    totalUdhar,
    reasons,
    reasonText: reasons.join(' & ')
  };
}

// 5. GET /api/customers/:phone/eligibility - Check if customer can be deleted
router.get('/:phone/eligibility', authenticateToken, async (req, res) => {
  try {
    const phone = req.params.phone.trim();
    const existing = await prisma.customer.findUnique({
      where: { phone }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const eligibility = await checkCustomerDeletionEligibility(phone, existing.name);
    res.json(eligibility);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. DELETE /api/customers/:phone - Delete customer profile from DB (Only when no active session & no udhar)
router.delete('/:phone', authenticateToken, async (req, res) => {
  try {
    const phone = req.params.phone.trim();

    const existing = await prisma.customer.findUnique({
      where: { phone }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Enforce condition: can ONLY be deleted if session is not active and has no udhar
    const eligibility = await checkCustomerDeletionEligibility(phone, existing.name);
    if (!eligibility.canDelete) {
      return res.status(400).json({
        error: `Cannot delete customer: ${eligibility.reasonText}. Please complete the active session and settle all udhars before deleting.`
      });
    }

    // Delete customer profile from Customer table (financial payments and past sessions remain safe)
    await prisma.customer.delete({
      where: { phone }
    });

    res.json({ message: `Customer "${existing.name}" deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

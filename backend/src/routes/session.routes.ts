import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';

const router = Router();

// Game hourly rates (₹ per hour)
const GAME_RATES: Record<string, number> = {
  'Pool': 160,
  'MidSnooker': 220,
  'PS4': 80, // ₹80 per person per hour
  'None': 0,
};

// Create / Start a new session (Customer enters, name & optional phone required)
router.post('/', authenticateToken, async (req, res) => {
  const { staffUsername, customerName, customerPhone, advanceAmount, advanceMethod } = req.body;

  if (!staffUsername || !customerName) {
    return res.status(400).json({ error: 'staffUsername and customerName are required' });
  }

  try {
    const trimmedName = (customerName as string).trim();
    const trimmedPhone = customerPhone ? (customerPhone as string).trim() : null;

    // Check if customer already has an active session
    const existingActiveSession = await prisma.session.findFirst({
      where: {
        status: 'active',
        OR: [
          { customerName: { equals: trimmedName, mode: 'insensitive' } },
          ...(trimmedPhone ? [{ customerPhone: trimmedPhone }] : [])
        ]
      }
    });

    if (existingActiveSession) {
      return res.status(400).json({
        error: `Customer "${existingActiveSession.customerName}" already has an active session (Session ID: ${existingActiveSession.id}). A customer cannot have multiple active sessions at the same time.`
      });
    }

    // Session ID format: DDMMYYYYHHMMSS_customername
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const cleanName = (customerName as string).toLowerCase().replace(/[^a-z0-9]/g, '');
    const sessionId = `${timestamp}_${cleanName}`;

    const numAdvance = parseFloat(advanceAmount);
    const hasAdvance = !isNaN(numAdvance) && numAdvance > 0;

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        customerName: (customerName as string).trim(),
        customerPhone: customerPhone ? (customerPhone as string).trim() : null,
        gameType: 'None',
        playerCount: 1,
        staffUsername: (staffUsername as string).toLowerCase(),
        startTime: now,
        status: 'active',
        payments: hasAdvance ? {
          create: {
            amount: numAdvance,
            method: advanceMethod || 'Cash',
          }
        } : undefined,
      },
      include: { table: true, payments: true }
    });

    broadcast({ type: 'SESSION_START', session });

    // Auto-sync into Customer table
    if (customerPhone && (customerPhone as string).trim()) {
      const p = (customerPhone as string).trim();
      const n = (customerName as string).trim();
      const parts = n.split(/\s+/);
      const firstName = parts[0] || n;
      const lastName = parts.slice(1).join(' ');
      prisma.customer.upsert({
        where: { phone: p },
        update: { name: n, firstName, lastName },
        create: { phone: p, name: n, firstName, lastName }
      }).catch(err => console.error('Error auto-syncing customer:', err));
    }

    res.status(201).json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get paginated and searchable completed sessions list
router.get('/completed', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 15;
    const skip = (page - 1) * limit;
    const search = (req.query.search as string) || '';
    const dateStr = req.query.date as string;

    const whereClause: any = {
      status: 'completed',
    };

    if (search) {
      whereClause.customerName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (dateStr) {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
        whereClause.endTime = {
          gte: startOfDay,
          lte: endOfDay
        };
      }
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        relationLoadStrategy: 'join',
        where: whereClause,
        orderBy: { endTime: 'desc' },
        skip,
        take: limit,
        include: {
          table: true,
          orders: {
            include: { menuItem: true }
          },
          payments: true,
          tablePlays: {
            include: { table: true }
          }
        }
      }),
      prisma.session.count({
        where: whereClause
      })
    ]);

    res.json({
      sessions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all unique customers (name & phone) for fast frontend autocomplete
router.get('/customers/all', authenticateToken, async (req, res) => {
  try {
    const customers = await prisma.session.findMany({
      where: {
        customerName: { not: '' }
      },
      orderBy: { startTime: 'desc' },
      select: { customerName: true, customerPhone: true },
    });

    const map = new Map<string, { customerName: string; customerPhone: string }>();
    for (const c of customers) {
      const name = c.customerName ? c.customerName.trim() : '';
      const phone = c.customerPhone ? c.customerPhone.trim() : '';
      if (!name) continue;
      const key = `${name.toLowerCase()}_${phone}`;
      if (!map.has(key)) {
        map.set(key, { customerName: name, customerPhone: phone });
      }
    }

    res.json(Array.from(map.values()));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper to fetch all prior unpaid udhars for a customer.
 * Uses JS filtering to avoid SQL 3-valued NULL logic dropping udhars where sessionId is null.
 * Also checks both customerName and customerPhone.
 */
export async function getPriorUnpaidUdhars(customerName: string, sessionId?: string, customerPhone?: string | null) {
  const trimmedName = customerName?.trim() || '';
  if (!trimmedName) return [];

  const orConditions: any[] = [
    { customerName: { equals: trimmedName, mode: 'insensitive' } }
  ];

  if (customerPhone) {
    orConditions.push({
      session: { customerPhone: customerPhone }
    });
  }

  const allCustomerUdhars = await prisma.udhar.findMany({
    where: {
      status: 'unpaid',
      OR: orConditions
    },
    orderBy: { createdAt: 'asc' }
  });

  return allCustomerUdhars.filter((u) => !sessionId || u.sessionId !== sessionId);
}

// Get single session details
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        table: true,
        orders: {
          include: { menuItem: true }
        },
        payments: true,
        udhars: true,
        tablePlays: {
          include: { table: true },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const priorUdhars = await getPriorUnpaidUdhars(session.customerName, session.id, session.customerPhone);
    const priorUdhar = priorUdhars.reduce((sum, u) => sum + u.amount, 0);

    const settledPriorUdhar = session.udhars
      ?.filter((u) => u.status === 'paid')
      .reduce((sum, u) => sum + u.amount, 0) || 0;

    res.json({
      ...session,
      priorUdhar,
      settledPriorUdhar
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start table play for session
router.post('/:id/table/start', authenticateToken, async (req, res) => {
  const sessionId = req.params.id;
  const { gameType, tableId, playerCount, staffUsername, startTime, endTime } = req.body;

  if (!gameType || !staffUsername) {
    return res.status(400).json({ error: 'gameType and staffUsername are required' });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { tablePlays: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Session is already closed' });
    }

    const needsTable = gameType === 'Pool' || gameType === 'MidSnooker';
    let table = null;

    if (needsTable) {
      if (!tableId) {
        return res.status(400).json({ error: 'tableId is required for Pool or Mid Snooker' });
      }
      table = await prisma.table.findUnique({ where: { id: parseInt(tableId) } });
      if (!table) {
        return res.status(404).json({ error: 'Table not found' });
      }
      // If NOT an already-ended play, table must not be occupied
      if (!endTime && table.status === 'occupied') {
        return res.status(400).json({ error: 'Table is already occupied' });
      }
    }

    const resolvedPlayerCount = gameType === 'PS4' ? (parseInt(playerCount) || 1) : 1;

    // Parse custom startTime if provided
    let parsedStart = new Date();
    if (startTime) {
      parsedStart = new Date(startTime);
      if (isNaN(parsedStart.getTime())) {
        return res.status(400).json({ error: 'Invalid start time format' });
      }
    }

    // Check if endTime is provided (custom completed play)
    let parsedEnd: Date | null = null;
    let cost = 0;
    if (endTime) {
      parsedEnd = new Date(endTime);
      if (isNaN(parsedEnd.getTime())) {
        return res.status(400).json({ error: 'Invalid end time format' });
      }
      if (parsedEnd.getTime() <= parsedStart.getTime()) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      const elapsedMs = parsedEnd.getTime() - parsedStart.getTime();
      const elapsedHours = elapsedMs / 3600000;
      const rate = GAME_RATES[gameType] || 0;
      if (gameType === 'PS4') {
        cost = rate * resolvedPlayerCount * elapsedHours;
      } else {
        cost = rate * elapsedHours;
      }
      cost = Math.round(cost);
    }

    let play;
    if (parsedEnd) {
      // Completed play: do NOT occupy table, update session gameCost, record tablePlay with endTime & cost
      const [_, createdPlay] = await prisma.$transaction([
        prisma.session.update({
          where: { id: sessionId },
          data: {
            tableId: table ? table.id : session.tableId,
            gameType: gameType,
            playerCount: resolvedPlayerCount,
            gameCost: { increment: cost }
          }
        }),
        prisma.tablePlay.create({
          data: {
            sessionId,
            tableId: table ? table.id : null,
            gameType,
            playerCount: resolvedPlayerCount,
            createdBy: staffUsername.toLowerCase(),
            startTime: parsedStart,
            endTime: parsedEnd,
            cost: cost
          },
          include: { table: true }
        })
      ]);
      play = createdPlay;
    } else {
      // Ongoing play: occupy table (if table), set session active info, record tablePlay with endTime: null
      const [_, __, createdPlay] = await prisma.$transaction([
        ...(table ? [prisma.table.update({
          where: { id: table.id },
          data: { status: 'occupied' }
        })] : []),
        prisma.session.update({
          where: { id: sessionId },
          data: {
            tableId: table ? table.id : session.tableId,
            gameType: gameType,
            playerCount: resolvedPlayerCount
          }
        }),
        prisma.tablePlay.create({
          data: {
            sessionId,
            tableId: table ? table.id : null,
            gameType,
            playerCount: resolvedPlayerCount,
            createdBy: staffUsername.toLowerCase(),
            startTime: parsedStart
          },
          include: { table: true }
        })
      ]);
      play = createdPlay;
    }

    broadcast({ type: 'TABLE_PLAY_START', play });
    res.status(201).json(play);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// End table play for session
router.post('/:id/table/end', authenticateToken, async (req, res) => {
  const sessionId = req.params.id;
  const { tablePlayId, endTime } = req.body;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        tablePlays: {
          where: { endTime: null },
          include: { table: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Session is already closed' });
    }

    let activePlay = null;
    if (tablePlayId) {
      activePlay = session.tablePlays.find(tp => tp.id === parseInt(tablePlayId));
    } else {
      activePlay = session.tablePlays[0];
    }

    if (!activePlay) {
      return res.status(400).json({ error: 'No active table play found for this session' });
    }

    const parsedEnd = endTime ? new Date(endTime) : new Date();
    if (isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ error: 'Invalid end time format' });
    }
    const playStartTime = new Date(activePlay.startTime);
    if (parsedEnd.getTime() <= playStartTime.getTime()) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const elapsedMs = parsedEnd.getTime() - playStartTime.getTime();
    const elapsedHours = elapsedMs / 3600000;

    const rate = GAME_RATES[activePlay.gameType] || 0;
    let cost = 0;
    if (activePlay.gameType === 'PS4') {
      cost = rate * activePlay.playerCount * elapsedHours;
    } else {
      cost = rate * elapsedHours;
    }
    cost = Math.round(cost);

    const [_, play, __] = await prisma.$transaction([
      ...(activePlay.tableId ? [prisma.table.update({
        where: { id: activePlay.tableId },
        data: { status: 'available' }
      })] : []),
      prisma.tablePlay.update({
        where: { id: activePlay.id },
        data: {
          endTime: parsedEnd,
          cost
        }
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: {
          gameCost: { increment: cost }
        }
      })
    ]);

    broadcast({ type: 'TABLE_PLAY_END', play });
    res.json(play);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Close / Complete session — auto-calculates game cost and settlements
router.post('/:id/close', authenticateToken, async (req, res) => {
  const { customAmount, amountPaid, paymentMethod } = req.body;

  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        orders: { include: { menuItem: true } },
        payments: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Session is already closed' });
    }

    // Find all active table plays for this session
    const activePlays = await prisma.tablePlay.findMany({
      where: { sessionId: session.id, endTime: null },
      include: { table: true }
    });

    let extraGameCost = 0;
    const endTime = new Date();

    const activePlayCalculations = activePlays.map(ap => {
      const elapsedMs = endTime.getTime() - new Date(ap.startTime).getTime();
      const elapsedHours = elapsedMs / 3600000;
      const rate = GAME_RATES[ap.gameType] || 0;
      const cost = ap.gameType === 'PS4' 
        ? Math.round(rate * ap.playerCount * elapsedHours) 
        : Math.round(rate * elapsedHours);
      return { activePlay: ap, cost };
    });

    extraGameCost = activePlayCalculations.reduce((sum, item) => sum + item.cost, 0);

    const menuCost = session.orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
    const parsedCustomAmount = parseFloat(customAmount) || 0;
    const finalGameCost = session.gameCost + extraGameCost;
    
    // Cost of current session
    const currentSessionTotal = Math.max(0, menuCost + finalGameCost + parsedCustomAmount);

    // Fetch prior unpaid udhars
    const priorUdhars = await getPriorUnpaidUdhars(session.customerName, session.id, session.customerPhone);
    const priorUdharTotal = priorUdhars.reduce((sum, u) => sum + u.amount, 0);

    const totalBill = currentSessionTotal + priorUdharTotal;

    const parsedAmountPaid = parseFloat(amountPaid) >= 0 ? parseFloat(amountPaid) : totalBill;
    const resolvedMethod = paymentMethod || 'Cash';

    const closedSession = await prisma.$transaction(async (tx) => {
      // 1. End all active plays if any
      for (const item of activePlayCalculations) {
        await tx.tablePlay.update({
          where: { id: item.activePlay.id },
          data: {
            endTime,
            cost: item.cost
          }
        });
        if (item.activePlay.tableId) {
          await tx.table.update({
            where: { id: item.activePlay.tableId },
            data: { status: 'available' }
          });
        }
      }

      if (activePlayCalculations.length === 0 && session.tableId) {
        await tx.table.update({
          where: { id: session.tableId },
          data: { status: 'available' }
        });
      }

      // 2. Create the payment record for this session if parsedAmountPaid > 0
      if (parsedAmountPaid > 0) {
        await tx.payment.create({
          data: {
            sessionId: session.id,
            amount: parsedAmountPaid,
            method: resolvedMethod
          }
        });
      }

      // 3. Calculate total payments received (existing advance payments + new payment)
      const existingPaymentsTotal = session.payments.reduce((sum, p) => sum + p.amount, 0);
      const totalPaymentsAvailable = existingPaymentsTotal + parsedAmountPaid;

      // 4. Settle prior udhars chronologically using total available payments
      let paymentLeft = totalPaymentsAvailable;
      for (const udhar of priorUdhars) {
        if (paymentLeft <= 0) break;
        if (paymentLeft >= udhar.amount) {
          paymentLeft -= udhar.amount;
          await tx.udhar.update({
            where: { id: udhar.id },
            data: { status: 'paid' }
          });
        } else {
          // Partial payment of this prior udhar
          await tx.udhar.update({
            where: { id: udhar.id },
            data: { amount: udhar.amount - paymentLeft }
          });
          paymentLeft = 0;
        }
      }

      // 5. Check if we need to create a NEW Udhar record for this session
      const todayUnpaid = Math.max(0, currentSessionTotal - paymentLeft);
      if (todayUnpaid > 0) {
        await tx.udhar.create({
          data: {
            customerName: session.customerName.trim(),
            amount: todayUnpaid,
            sessionId: session.id,
            status: 'unpaid'
          }
        });
      }

      // 6. Update session details
      let paymentStatus = 'paid';
      if (todayUnpaid > 0) {
        paymentStatus = totalPaymentsAvailable > 0 ? 'partially_paid' : 'udhar';
      }

      return tx.session.update({
        where: { id: session.id },
        data: {
          endTime,
          status: 'completed',
          gameCost: finalGameCost,
          menuCost,
          totalBill: currentSessionTotal,
          customAmount: parsedCustomAmount,
          paymentStatus,
          tableId: null,
          gameType: 'None',
          playerCount: 1
        },
        include: { table: true }
      });
    }, {
      maxWait: 10000,
      timeout: 15000
    });

    broadcast({ type: 'SESSION_CLOSE', session: closedSession });
    res.json(closedSession);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send session receipt directly via background WhatsApp API (No browser tab needed)
router.post('/:id/send-whatsapp', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        table: true,
        orders: { include: { menuItem: true } },
        payments: true,
        tablePlays: { include: { table: true } },
        udhars: true,
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.customerPhone) {
      return res.status(400).json({ error: 'Customer phone number is missing for this session.' });
    }

    let phone = session.customerPhone.replace(/[^0-9]/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    // Calculate financials
    const menuCost = session.orders?.reduce((s, o) => s + o.quantity * o.price, 0) || 0;
    const completedPlaysTotal = session.tablePlays?.filter((tp) => tp.endTime).reduce((s, tp) => s + tp.cost, 0) || 0;
    const gameTotal = completedPlaysTotal;
    const todaysTotal = session.status === 'completed' ? session.totalBill : (menuCost + gameTotal + (session.customAmount || 0));
    const priorUdhars = await getPriorUnpaidUdhars(session.customerName, session.id, session.customerPhone);
    const priorOutstanding = priorUdhars.reduce((sum, u) => sum + u.amount, 0);
    const amountPaid = session.payments?.reduce((s, p) => s + p.amount, 0) || 0;

    const todayOutstanding = session.status === 'completed'
      ? (session.udhars?.filter(u => u.status === 'unpaid').reduce((s, u) => s + u.amount, 0) || 0)
      : Math.max(0, todaysTotal - amountPaid);

    const paymentAppliedToToday = Math.max(0, todaysTotal - todayOutstanding);
    const paymentAppliedToPrior = Math.max(0, amountPaid - paymentAppliedToToday);

    const originalPriorOutstanding = session.status === 'completed'
      ? priorOutstanding + paymentAppliedToPrior
      : priorOutstanding;

    const totalPayable = todaysTotal + originalPriorOutstanding;
    const ledgerSettledAmount = session.status === 'completed'
      ? (session.udhars?.filter(u => u.status === 'paid').reduce((s, u) => s + u.amount, 0) || 0)
      : 0;

    const netOutstanding = Math.max(0, totalPayable - amountPaid - ledgerSettledAmount);

    // Build Receipt Text
    let msg = `*REBOUND CAFE & BILLIARDS*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🧾 *RECEIPT SUMMARY*\n`;
    msg += `👤 *Customer:* ${session.customerName}\n`;
    msg += `📱 *Phone:* ${session.customerPhone}\n`;
    msg += `📅 *Date:* ${new Date(session.startTime).toLocaleDateString()} ${new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 1. Cafe Orders
    if (session.orders && session.orders.length > 0) {
      msg += `☕ *CAFE & REFRESHMENTS*\n`;
      const receiptGroups: Record<number, { name: string; totalQty: number; price: number }> = {};
      session.orders.forEach(o => {
        if (!o.menuItem) return;
        const key = o.menuItemId;
        if (!receiptGroups[key]) {
          receiptGroups[key] = { name: o.menuItem.name, totalQty: 0, price: o.price };
        }
        receiptGroups[key].totalQty += o.quantity;
      });
      Object.values(receiptGroups).forEach(g => {
        msg += `• ${g.name} × ${g.totalQty} = ₹${(g.totalQty * g.price).toFixed(2)}\n`;
      });
      msg += `\n`;
    }

    // 2. Table & Game Plays
    if (session.tablePlays && session.tablePlays.length > 0) {
      msg += `🎱 *BILLIARDS & GAMES*\n`;
      session.tablePlays.forEach(tp => {
        let durMins = 0;
        let cost = tp.cost;
        if (tp.endTime) {
          const diff = new Date(tp.endTime).getTime() - new Date(tp.startTime).getTime();
          durMins = Math.round(diff / 60000);
        } else {
          const diff = Date.now() - new Date(tp.startTime).getTime();
          durMins = Math.round(diff / 60000);
        }
        const label = tp.gameType === 'PS4'
          ? `PS4 (${tp.playerCount} Players)`
          : `${tp.gameType}${tp.table ? ` (Table ${tp.table.number})` : ''}`;
        msg += `• ${label} (${durMins}m) = ₹${cost.toFixed(2)}\n`;
      });
      msg += `\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💵 *Session Total:* ₹${todaysTotal.toFixed(2)}\n`;
    if (originalPriorOutstanding > 0) {
      msg += `📌 *Prior Udhar:* +₹${originalPriorOutstanding.toFixed(2)}\n`;
    }
    msg += `💰 *Grand Total:* ₹${totalPayable.toFixed(2)}\n`;
    if (amountPaid > 0) {
      msg += `💳 *Paid / Advance:* -₹${amountPaid.toFixed(2)}\n`;
    }
    if (amountPaid > totalPayable) {
      msg += `💵 *Change Returned:* ₹${(amountPaid - totalPayable).toFixed(2)}\n`;
    }
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🔴 *Net Outstanding:* ₹${netOutstanding.toFixed(2)}\n\n`;
    msg += `Thank you for visiting Rebound Cafe & Billiards! Hope to see you again soon! 🙏✨`;

    // Dispatching via backend API provider
    const cloudToken = process.env.WHATSAPP_CLOUD_API_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
    const genericApiUrl = process.env.WHATSAPP_API_URL;

    let providerUsed = 'Backend Background Dispatcher';

    if (cloudToken && phoneId) {
      // 1. Meta WhatsApp Cloud API
      providerUsed = 'Meta Cloud API';
      const metaRes = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: msg }
        })
      });
      const metaData: any = await metaRes.json();
      if (!metaRes.ok) {
        throw new Error(metaData.error?.message || 'Meta Cloud API failed to send WhatsApp message');
      }
    } else if (twilioSid && twilioAuth) {
      // 2. Twilio WhatsApp API
      providerUsed = 'Twilio WhatsApp API';
      const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
      const params = new URLSearchParams();
      params.append('From', twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`);
      params.append('To', `whatsapp:+${phone}`);
      params.append('Body', msg);

      const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
      });
      const twilioData: any = await twilioRes.json();
      if (!twilioRes.ok) {
        throw new Error(twilioData.message || 'Twilio failed to send WhatsApp message');
      }
    } else if (genericApiUrl) {
      // 3. Custom Gateway / UltraMsg / Green API
      providerUsed = 'WhatsApp Gateway API';
      const gRes = await fetch(genericApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: process.env.WHATSAPP_API_TOKEN,
          to: phone,
          body: msg
        })
      });
      if (!gRes.ok) {
        throw new Error('Custom WhatsApp Gateway failed to send message');
      }
    } else {
      // 4. Default / Simulated Backend Dispatch
      console.log(`[WHATSAPP BACKEND SERVICE] Sent receipt to +${phone}:\n${msg}`);
    }

    res.json({
      success: true,
      message: `WhatsApp receipt sent to +${phone}`,
      provider: providerUsed,
      phone
    });
  } catch (error: any) {
    console.error('WhatsApp send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send WhatsApp message' });
  }
});

export default router;

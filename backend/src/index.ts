import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { initWebSocket } from './websocket';

// Route imports
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import sessionRoutes from './routes/session.routes';
import menuRoutes from './routes/menu.routes';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import tableBookingRoutes from './routes/tableBooking.routes';
import udharRoutes from './routes/udhar.routes';
import tableRoutes from './routes/table.routes';

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;

const prismaClient = new PrismaClient();
export const prisma = prismaClient.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      const start = Date.now();
      const result = await query(args);
      const duration = Date.now() - start;
      console.log(`[PRISMA] ${model || 'Database'}.${operation} took ${duration}ms`);
      return result;
    },
  },
});

// CORS — allow frontend origin from env var (set on Render)
const allowedOrigins = [
  'https://rebound-taupe-theta.vercel.app',  // production frontend
  process.env.FRONTEND_URL,                   // from Render env var
  'http://localhost:3000',                    // local dev
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Routes setup
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/bookings', tableBookingRoutes);
app.use('/api/udhar', udharRoutes);
app.use('/api/tables', tableRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date() });
});

// Initialize WebSocket server
initWebSocket(server);

server.listen(port, () => {
  console.log(`Rebound ERP Backend listening on http://localhost:${port}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  try {
    // Stop accepting new connections
    server.close(() => {
      console.log('HTTP server closed.');
    });
    // Disconnect Prisma
    await prisma.$disconnect();
    console.log('Prisma disconnected successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon restarts

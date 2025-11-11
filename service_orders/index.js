require('dotenv').config();
const express = require('express');
const cors = require('cors');
const requestIdMiddleware = require('./middleware/requestId');
const authMiddleware = require('./middleware/auth');
const logger = require('./utils/logger');
const {
  createOrder,
  getOrder,
  getOrders,
  updateOrderStatus,
  cancelOrder
} = require('./controllers/orderController');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Health check routes
app.get('/status', (req, res) => {
    res.json({
        success: true,
        data: { status: 'Orders service is running' }
    });
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'OK',
            service: 'Orders Service',
            timestamp: new Date().toISOString()
        }
    });
});

// API v1 routes - Orders (все защищены аутентификацией)
app.post('/api/v1/orders', authMiddleware(), createOrder);
app.get('/api/v1/orders', authMiddleware(), getOrders);
app.get('/api/v1/orders/:id', authMiddleware(), getOrder);
app.put('/api/v1/orders/:id/status', authMiddleware(), updateOrderStatus);
app.delete('/api/v1/orders/:id', authMiddleware(), cancelOrder);

// Start server
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Orders service running on port ${PORT}`);
});
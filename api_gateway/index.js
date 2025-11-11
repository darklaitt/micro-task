require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const requestIdMiddleware = require('./middleware/requestId');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8000;

// Service URLs
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://service_users:8000';
const ORDERS_SERVICE_URL = process.env.ORDERS_SERVICE_URL || 'http://service_orders:8000';

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
app.use(express.json());
app.use(requestIdMiddleware);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // макс 100 запросов с одного IP
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Слишком много запросов, попробуйте позже'
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

/**
 * Проксирование запроса к микросервису
 */
async function proxyRequest(req, res, serviceUrl) {
    try {
        const headers = {
            'Content-Type': 'application/json',
            'X-Request-ID': req.requestId
        };

        // Прокидываем Authorization заголовок
        if (req.headers['authorization']) {
            headers['Authorization'] = req.headers['authorization'];
        }

        const config = {
            method: req.method,
            url: `${serviceUrl}${req.url}`,
            headers,
            timeout: 10000
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            config.data = req.body;
        }

        if (req.method === 'GET' && Object.keys(req.query).length > 0) {
            config.params = req.query;
        }

        req.log?.info({ 
            targetService: serviceUrl, 
            method: req.method, 
            path: req.url 
        }, 'Proxying request');

        const response = await axios(config);

        // Прокидываем заголовки ответа
        if (response.headers['x-request-id']) {
            res.setHeader('X-Request-ID', response.headers['x-request-id']);
        }

        res.status(response.status).json(response.data);
    } catch (error) {
        if (error.response) {
            // Сервис ответил с ошибкой
            req.log?.warn({ 
                status: error.response.status, 
                error: error.response.data 
            }, 'Service returned error');
            res.status(error.response.status).json(error.response.data);
        } else if (error.code === 'ECONNABORTED') {
            req.log?.error('Request timeout');
            res.status(504).json({
                success: false,
                error: {
                    code: 'GATEWAY_TIMEOUT',
                    message: 'Сервис не отвечает'
                }
            });
        } else {
            req.log?.error({ error: error.message }, 'Proxy error');
            res.status(503).json({
                success: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'Сервис временно недоступен'
                }
            });
        }
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'API Gateway is running',
            timestamp: new Date().toISOString()
        }
    });
});

app.get('/status', (req, res) => {
    res.json({
        success: true,
        data: { status: 'API Gateway is running' }
    });
});

// Proxy routes для сервиса пользователей
app.all('/api/v1/auth/*', (req, res) => proxyRequest(req, res, USERS_SERVICE_URL));
app.all('/api/v1/users*', (req, res) => proxyRequest(req, res, USERS_SERVICE_URL));

// Proxy routes для сервиса заказов
app.all('/api/v1/orders*', (req, res) => proxyRequest(req, res, ORDERS_SERVICE_URL));

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Маршрут не найден'
        }
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`API Gateway running on port ${PORT}`);
    logger.info(`Proxying /api/v1/auth/* and /api/v1/users* to ${USERS_SERVICE_URL}`);
    logger.info(`Proxying /api/v1/orders* to ${ORDERS_SERVICE_URL}`);
});
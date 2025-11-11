require('dotenv').config();
const express = require('express');
const cors = require('cors');
const requestIdMiddleware = require('./middleware/requestId');
const logger = require('./utils/logger');
const { register, login } = require('./controllers/authController');
const authMiddleware = require('./middleware/auth');
const { usersDb } = require('./controllers/authController');
const { UpdateProfileSchema } = require('./models/user');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Health check routes
app.get('/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'OK',
            service: 'Users Service',
            timestamp: new Date().toISOString()
        }
    });
});

app.get('/status', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'Users service is running'
        }
    });
});

// API v1 routes - Authentication
app.post('/api/v1/auth/register', register);
app.post('/api/v1/auth/login', login);

// Получение профиля текущего пользователя
app.get('/api/v1/users/profile', authMiddleware(), (req, res) => {
    const user = usersDb.get(req.user.userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            error: {
                code: 'USER_NOT_FOUND',
                message: 'Пользователь не найден'
            }
        });
    }
    res.json({ success: true, data: user.toJSON() });
});

// Обновление профиля текущего пользователя
app.put('/api/v1/users/profile', authMiddleware(), (req, res) => {
    const user = usersDb.get(req.user.userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            error: {
                code: 'USER_NOT_FOUND',
                message: 'Пользователь не найден'
            }
        });
    }
    try {
        const validated = UpdateProfileSchema.parse(req.body);
        user.update(validated);
        res.json({ success: true, data: user.toJSON() });
    } catch (error) {
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Ошибка валидации данных',
                    details: error.errors
                }
            });
        }
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Внутренняя ошибка сервера'
            }
        });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Users service running on port ${PORT}`);
});
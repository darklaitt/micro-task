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

// Получение списка пользователей (только для администраторов)
app.get('/api/v1/users', authMiddleware(['admin']), (req, res) => {
    try {
        // Параметры пагинации
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const role = req.query.role;
        const search = req.query.search;

        // Получаем всех пользователей
        let users = Array.from(usersDb.values());

        // Фильтрация по роли
        if (role) {
            users = users.filter(u => u.roles.includes(role));
        }

        // Поиск по имени или email
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(u => 
                u.name.toLowerCase().includes(searchLower) || 
                u.email.toLowerCase().includes(searchLower)
            );
        }

        // Подсчёт общего количества
        const total = users.length;
        const totalPages = Math.ceil(total / limit);

        // Пагинация
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedUsers = users.slice(startIndex, endIndex);

        req.log?.info({ page, limit, total, filters: { role, search } }, 'Users list requested');

        res.json({
            success: true,
            data: {
                users: paginatedUsers.map(u => u.toJSON()),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });
    } catch (error) {
        req.log?.error({ error: error.message }, 'Error fetching users list');
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
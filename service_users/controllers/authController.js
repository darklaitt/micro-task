const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, RegisterSchema, LoginSchema } = require('../models/user');

// Секретный ключ для JWT (в продакшене должен быть в .env)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Временное хранилище пользователей (вместо БД)
const usersDb = new Map();

/**
 * Контроллер регистрации нового пользователя
 */
async function register(req, res) {
  try {
    // Валидация входных данных
    const validatedData = RegisterSchema.parse(req.body);
    
    // Проверка, существует ли пользователь с таким email
    const existingUser = Array.from(usersDb.values()).find(
      u => u.email === validatedData.email
    );
    
    if (existingUser) {
      req.log?.warn({ email: validatedData.email }, 'Attempt to register existing email');
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Пользователь с таким email уже существует'
        }
      });
    }
    
    // Хеширование пароля
    const passwordHash = await bcrypt.hash(validatedData.password, 10);
    
    // Создание нового пользователя
    const user = new User({
      email: validatedData.email,
      passwordHash,
      name: validatedData.name,
      roles: validatedData.roles
    });
    
    // Сохранение в "БД"
    usersDb.set(user.id, user);
    
    req.log?.info({ userId: user.id, email: user.email }, 'User registered successfully');
    
    // Генерация JWT токена
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        roles: user.roles 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.status(201).json({
      success: true,
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      req.log?.warn({ errors: error.errors }, 'Validation error during registration');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Ошибка валидации данных',
          details: error.errors
        }
      });
    }
    
    req.log?.error({ error: error.message }, 'Error during registration');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера'
      }
    });
  }
}

/**
 * Контроллер входа пользователя
 */
async function login(req, res) {
  try {
    // Валидация входных данных
    const validatedData = LoginSchema.parse(req.body);
    
    // Поиск пользователя по email
    const user = Array.from(usersDb.values()).find(
      u => u.email === validatedData.email
    );
    
    if (!user) {
      req.log?.warn({ email: validatedData.email }, 'Login attempt with non-existent email');
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль'
        }
      });
    }
    
    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(
      validatedData.password,
      user.passwordHash
    );
    
    if (!isPasswordValid) {
      req.log?.warn({ userId: user.id }, 'Login attempt with invalid password');
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Неверный email или пароль'
        }
      });
    }
    
    req.log?.info({ userId: user.id, email: user.email }, 'User logged in successfully');
    
    // Генерация JWT токена
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        roles: user.roles 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    res.json({
      success: true,
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      req.log?.warn({ errors: error.errors }, 'Validation error during login');
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Ошибка валидации данных',
          details: error.errors
        }
      });
    }
    
    req.log?.error({ error: error.message }, 'Error during login');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера'
      }
    });
  }
}

// Экспорт хранилища для использования в других контроллерах
module.exports = {
  register,
  login,
  usersDb,
  JWT_SECRET
};

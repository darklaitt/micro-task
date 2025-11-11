const { Order, CreateOrderSchema, UpdateOrderStatusSchema } = require('../models/order');
const axios = require('axios');
const orderEvents = require('../events/orderEvents');

// Временное хранилище заказов (вместо БД)
const ordersDb = new Map();

// URL сервиса пользователей для проверки существования пользователя
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || 'http://service_users:8000';

/**
 * Проверка существования пользователя
 */
async function checkUserExists(userId) {
  try {
    // В реальном приложении здесь был бы запрос к сервису пользователей
    // Для упрощения возвращаем true
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Создание нового заказа
 */
async function createOrder(req, res) {
  try {
    const validatedData = CreateOrderSchema.parse(req.body);
    
    // Проверка, что пользователь создаёт заказ для себя (или это админ)
    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin && validatedData.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Вы можете создавать заказы только для себя'
        }
      });
    }

    // Проверка существования пользователя
    const userExists = await checkUserExists(validatedData.userId);
    if (!userExists) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Пользователь не найден'
        }
      });
    }

    // Создание заказа
    const order = new Order(validatedData);
    ordersDb.set(order.id, order);

    // Публикация события создания заказа
    orderEvents.publishOrderCreated(order);

    req.log?.info({ orderId: order.id, userId: order.userId }, 'Order created');

    res.status(201).json({
      success: true,
      data: order.toJSON()
    });
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

    req.log?.error({ error: error.message }, 'Error creating order');
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
 * Получение заказа по ID
 */
function getOrder(req, res) {
  try {
    const orderId = req.params.id;
    const order = ordersDb.get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Заказ не найден'
        }
      });
    }

    // Проверка прав доступа: пользователь может видеть только свои заказы
    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin && order.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Недостаточно прав для доступа к заказу'
        }
      });
    }

    res.json({
      success: true,
      data: order.toJSON()
    });
  } catch (error) {
    req.log?.error({ error: error.message }, 'Error fetching order');
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
 * Получение списка заказов
 */
function getOrders(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';

    let orders = Array.from(ordersDb.values());

    // Фильтрация: пользователь видит только свои заказы, админ — все
    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin) {
      orders = orders.filter(o => o.userId === req.user.userId);
    }

    // Фильтрация по статусу
    if (status) {
      orders = orders.filter(o => o.status === status);
    }

    // Сортировка
    orders.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    // Пагинация
    const total = orders.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedOrders = orders.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      data: {
        orders: paginatedOrders.map(o => o.toJSON()),
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
    req.log?.error({ error: error.message }, 'Error fetching orders');
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
 * Обновление статуса заказа
 */
function updateOrderStatus(req, res) {
  try {
    const orderId = req.params.id;
    const order = ordersDb.get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Заказ не найден'
        }
      });
    }

    // Проверка прав: только владелец или админ
    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin && order.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Недостаточно прав для изменения заказа'
        }
      });
    }

    const validatedData = UpdateOrderStatusSchema.parse(req.body);
    const oldStatus = order.status;
    order.updateStatus(validatedData.status);

    // Публикация события обновления статуса
    orderEvents.publishOrderStatusUpdated(order, oldStatus);

    req.log?.info({ orderId, newStatus: validatedData.status }, 'Order status updated');

    res.json({
      success: true,
      data: order.toJSON()
    });
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

    if (error.message.includes('Невозможно')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OPERATION',
          message: error.message
        }
      });
    }

    req.log?.error({ error: error.message }, 'Error updating order status');
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
 * Отмена заказа
 */
function cancelOrder(req, res) {
  try {
    const orderId = req.params.id;
    const order = ordersDb.get(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'Заказ не найден'
        }
      });
    }

    // Проверка прав: только владелец или админ
    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin && order.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Недостаточно прав для отмены заказа'
        }
      });
    }

    const oldStatus = order.status;
    order.cancel();

    // Публикация события обновления статуса (отмена)
    orderEvents.publishOrderStatusUpdated(order, oldStatus);

    req.log?.info({ orderId }, 'Order cancelled');

    res.json({
      success: true,
      data: order.toJSON()
    });
  } catch (error) {
    if (error.message.includes('Невозможно')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OPERATION',
          message: error.message
        }
      });
    }

    req.log?.error({ error: error.message }, 'Error cancelling order');
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Внутренняя ошибка сервера'
      }
    });
  }
}

module.exports = {
  createOrder,
  getOrder,
  getOrders,
  updateOrderStatus,
  cancelOrder,
  ordersDb
};

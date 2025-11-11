const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * Система доменных событий для заказов
 */
class OrderEvents extends EventEmitter {
  constructor() {
    super();
    this.setupListeners();
  }

  /**
   * Публикация события создания заказа
   */
  publishOrderCreated(order) {
    const event = {
      type: 'order.created',
      timestamp: new Date().toISOString(),
      data: {
        orderId: order.id,
        userId: order.userId,
        totalAmount: order.totalAmount,
        status: order.status,
        items: order.items
      }
    };

    logger.info({ event }, 'Publishing order.created event');
    this.emit('order.created', event);
  }

  /**
   * Публикация события обновления статуса заказа
   */
  publishOrderStatusUpdated(order, oldStatus) {
    const event = {
      type: 'order.status.updated',
      timestamp: new Date().toISOString(),
      data: {
        orderId: order.id,
        userId: order.userId,
        oldStatus,
        newStatus: order.status,
        updatedAt: order.updatedAt
      }
    };

    logger.info({ event }, 'Publishing order.status.updated event');
    this.emit('order.status.updated', event);
  }

  /**
   * Настройка слушателей событий
   * В реальном приложении здесь могли бы быть обработчики для отправки уведомлений,
   * обновления других сервисов и т.д.
   */
  setupListeners() {
    this.on('order.created', (event) => {
      logger.info({ eventData: event.data }, 'Order created event received');
      // Здесь можно добавить логику:
      // - Отправка уведомления пользователю
      // - Обновление инвентаря
      // - Отправка в систему аналитики
      // - Публикация в message broker (RabbitMQ, Kafka)
    });

    this.on('order.status.updated', (event) => {
      logger.info({ eventData: event.data }, 'Order status updated event received');
      // Здесь можно добавить логику:
      // - Отправка уведомления об изменении статуса
      // - Триггер для следующего шага в бизнес-процессе
      // - Обновление внешних систем
    });
  }

  /**
   * Получение всех событий (для debugging/мониторинга)
   */
  getEventTypes() {
    return {
      orderCreated: 'order.created',
      orderStatusUpdated: 'order.status.updated'
    };
  }
}

// Создаём singleton instance
const orderEvents = new OrderEvents();

module.exports = orderEvents;

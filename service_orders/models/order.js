const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');

// Zod схема для элемента заказа (товар + количество)
const OrderItemSchema = z.object({
  productName: z.string().min(1, { message: 'Название товара обязательно' }),
  quantity: z.number().int().positive({ message: 'Количество должно быть положительным числом' }),
  price: z.number().positive({ message: 'Цена должна быть положительным числом' })
});

// Zod схема для создания заказа
const CreateOrderSchema = z.object({
  userId: z.string().uuid({ message: 'userId должен быть валидным UUID' }),
  items: z.array(OrderItemSchema).min(1, { message: 'Заказ должен содержать хотя бы один товар' }),
  totalAmount: z.number().positive().optional()
});

// Zod схема для обновления статуса
const UpdateOrderStatusSchema = z.object({
  status: z.enum(['created', 'in_progress', 'completed', 'cancelled'], {
    message: 'Статус может быть: created, in_progress, completed, cancelled'
  })
});

// Zod схема полного заказа
const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  items: z.array(OrderItemSchema),
  status: z.enum(['created', 'in_progress', 'completed', 'cancelled']),
  totalAmount: z.number().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

/**
 * Класс модели заказа
 */
class Order {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.userId = data.userId;
    this.items = data.items || [];
    this.status = data.status || 'created';
    this.totalAmount = data.totalAmount || this.calculateTotal();
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Вычисляет общую сумму заказа
   */
  calculateTotal() {
    return this.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
  }

  /**
   * Обновляет статус заказа
   */
  updateStatus(newStatus) {
    const validStatuses = ['created', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Недопустимый статус: ${newStatus}`);
    }
    
    // Проверка возможности изменения статуса
    if (this.status === 'cancelled' || this.status === 'completed') {
      throw new Error('Невозможно изменить статус завершённого или отменённого заказа');
    }
    
    this.status = newStatus;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Отменяет заказ
   */
  cancel() {
    if (this.status === 'completed') {
      throw new Error('Невозможно отменить завершённый заказ');
    }
    if (this.status === 'cancelled') {
      throw new Error('Заказ уже отменён');
    }
    
    this.status = 'cancelled';
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Проверяет, можно ли редактировать заказ
   */
  canBeModified() {
    return this.status === 'created';
  }

  /**
   * Возвращает JSON представление заказа
   */
  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      items: this.items,
      status: this.status,
      totalAmount: this.totalAmount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = {
  Order,
  OrderSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  OrderItemSchema
};

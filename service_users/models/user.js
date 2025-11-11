const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');

// Zod схема для валидации пользователя
const UserSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email({ message: 'Некорректный email адрес' }),
  password: z.string().min(6, { message: 'Пароль должен содержать минимум 6 символов' }),
  name: z.string().min(1, { message: 'Имя обязательно' }),
  roles: z.array(z.enum(['user', 'admin', 'manager'])).default(['user']),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

// Схема для регистрации (без id и timestamps)
const RegisterSchema = z.object({
  email: z.string().email({ message: 'Некорректный email адрес' }),
  password: z.string().min(6, { message: 'Пароль должен содержать минимум 6 символов' }),
  name: z.string().min(1, { message: 'Имя обязательно' }),
  roles: z.array(z.enum(['user', 'admin', 'manager'])).optional().default(['user'])
});

// Схема для входа
const LoginSchema = z.object({
  email: z.string().email({ message: 'Некорректный email адрес' }),
  password: z.string().min(1, { message: 'Пароль обязателен' })
});

// Схема для обновления профиля
const UpdateProfileSchema = z.object({
  name: z.string().min(1, { message: 'Имя обязательно' }).optional(),
  email: z.string().email({ message: 'Некорректный email адрес' }).optional()
});

/**
 * Класс модели пользователя
 */
class User {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.email = data.email;
    this.passwordHash = data.passwordHash || data.password; // для совместимости
    this.name = data.name;
    this.roles = data.roles || ['user'];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Возвращает объект пользователя без чувствительных данных
   */
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      roles: this.roles,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Обновляет поля пользователя
   */
  update(data) {
    if (data.name) this.name = data.name;
    if (data.email) this.email = data.email;
    if (data.passwordHash) this.passwordHash = data.passwordHash;
    if (data.roles) this.roles = data.roles;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Проверяет, имеет ли пользователь указанную роль
   */
  hasRole(role) {
    return this.roles.includes(role);
  }

  /**
   * Проверяет, является ли пользователь администратором
   */
  isAdmin() {
    return this.hasRole('admin');
  }
}

module.exports = {
  User,
  UserSchema,
  RegisterSchema,
  LoginSchema,
  UpdateProfileSchema
};

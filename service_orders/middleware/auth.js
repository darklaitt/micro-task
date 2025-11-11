const jwt = require('jsonwebtoken');

// Секретный ключ для JWT (должен совпадать с service_users)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware для проверки JWT токена в сервисе заказов
 */
function authMiddleware(requiredRoles = []) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Требуется токен авторизации'
        }
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;

      // Проверка ролей, если указаны
      if (requiredRoles.length > 0 && !requiredRoles.some(role => payload.roles.includes(role))) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Недостаточно прав для доступа'
          }
        });
      }

      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Недействительный или истёкший токен'
        }
      });
    }
  };
}

module.exports = authMiddleware;

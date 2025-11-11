const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Middleware для добавления уникального ID запроса
 * Поддерживает X-Request-ID из входящего запроса или генерирует новый
 */
function requestIdMiddleware(req, res, next) {
  // Получаем или создаём Request ID
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  // Сохраняем в объект запроса
  req.requestId = requestId;
  
  // Добавляем в заголовки ответа
  res.setHeader('X-Request-ID', requestId);
  
  // Создаём child logger с requestId
  req.log = logger.child({ requestId });
  
  // Логируем входящий запрос
  req.log.info({
    method: req.method,
    url: req.url,
    ip: req.ip
  }, 'Incoming request');
  
  // Логируем ответ
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.log.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    }, 'Request completed');
  });
  
  next();
}

module.exports = requestIdMiddleware;

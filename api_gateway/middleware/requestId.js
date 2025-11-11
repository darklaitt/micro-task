const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Middleware для добавления уникального ID запроса
 * Генерирует новый UUID для каждого входящего запроса
 */
function requestIdMiddleware(req, res, next) {
  // Генерируем новый Request ID на уровне шлюза
  const requestId = uuidv4();
  
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
    ip: req.ip,
    userAgent: req.headers['user-agent']
  }, 'Gateway received request');
  
  // Логируем ответ
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    req.log.info({
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    }, 'Gateway completed request');
  });
  
  next();
}

module.exports = requestIdMiddleware;

/**
 * 时钟应用 - Node.js HTTP 服务器
 * 提供静态文件服务，支持跨域请求
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 配置
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // 监听所有网络接口

// MIME类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

// 默认文件（当请求目录时）
const DEFAULT_FILES = ['index.html', 'default.html'];

/**
 * 获取文件的MIME类型
 * @param {string} filePath - 文件路径
 * @returns {string} MIME类型
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * 发送响应
 * @param {http.ServerResponse} res - 响应对象
 * @param {number} statusCode - 状态码
 * @param {string} contentType - 内容类型
 * @param {Buffer|string} content - 响应内容
 */
function sendResponse(res, statusCode, contentType, content) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  res.end(content);
}

/**
 * 发送错误响应
 * @param {http.ServerResponse} res - 响应对象
 * @param {number} statusCode - 状态码
 * @param {string} message - 错误消息
 */
function sendError(res, statusCode, message) {
  const html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${statusCode} - 错误</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh; 
          margin: 0; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .error-container { 
          text-align: center; 
          padding: 40px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        .error-code { 
          font-size: 6rem; 
          font-weight: 800; 
          margin: 0;
          text-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        .error-message { 
          font-size: 1.5rem; 
          margin: 20px 0;
          opacity: 0.9;
        }
        .error-description { 
          font-size: 1rem; 
          opacity: 0.7;
          margin-bottom: 30px;
        }
        .back-btn {
          display: inline-block;
          padding: 12px 24px;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .back-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1 class="error-code">${statusCode}</h1>
        <p class="error-message">${message}</p>
        <p class="error-description">抱歉，您访问的页面出现了问题</p>
        <a href="/" class="back-btn">返回首页</a>
      </div>
    </body>
    </html>
  `;
  sendResponse(res, statusCode, 'text/html; charset=utf-8', html);
}

/**
 * 处理文件请求
 * @param {http.ServerRequest} req - 请求对象
 * @param {http.ServerResponse} res - 响应对象
 */
function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  
  // 处理根路径
  if (pathname === '/') {
    pathname = '/index.html';
  }
  
  // 安全检查：防止路径遍历攻击
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);
  
  // 检查文件是否在当前目录内
  if (!filePath.startsWith(__dirname)) {
    sendError(res, 403, '禁止访问');
    return;
  }
  
  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        sendError(res, 404, '页面未找到');
      } else {
        console.error(`文件访问错误: ${err.message}`);
        sendError(res, 500, '服务器内部错误');
      }
      return;
    }
    
    // 如果是目录，尝试查找默认文件
    if (stats.isDirectory()) {
      for (const defaultFile of DEFAULT_FILES) {
        const defaultPath = path.join(filePath, defaultFile);
        if (fs.existsSync(defaultPath)) {
          return handleRequest({ ...req, url: path.join(pathname, defaultFile) }, res);
        }
      }
      sendError(res, 403, '目录访问被禁止');
      return;
    }
    
    // 读取并发送文件
    fs.readFile(filePath, (err, content) => {
      if (err) {
        console.error(`文件读取错误: ${err.message}`);
        sendError(res, 500, '服务器内部错误');
        return;
      }
      
      const contentType = getMimeType(filePath);
      sendResponse(res, 200, contentType, content);
    });
  });
}

/**
 * 创建HTTP服务器
 */
function createServer() {
  const server = http.createServer((req, res) => {
    // 处理OPTIONS请求（预检请求）
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }
    
    // 记录请求日志
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    
    // 处理请求
    handleRequest(req, res);
  });
  
  // 错误处理
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n错误: 端口 ${PORT} 已被占用`);
      console.log('请尝试使用其他端口，例如: PORT=3001 node server.js');
      process.exit(1);
    } else {
      console.error(`服务器错误: ${err.message}`);
      process.exit(1);
    }
  });
  
  return server;
}

/**
 * 启动服务器
 */
function startServer() {
  const server = createServer();
  
  server.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(50));
    console.log('时钟应用服务器启动成功!');
    console.log('='.repeat(50));
    console.log(`服务器地址: http://localhost:${PORT}`);
    console.log(`监听地址: ${HOST}`);
    console.log(`工作目录: ${__dirname}`);
    console.log('\n可用的访问方式:');
    console.log(`  1. 本地访问: http://localhost:${PORT}`);
    
    // 尝试获取本机IP用于局域网访问
    const networkInterfaces = require('os').networkInterfaces();
    const ips = [];
    for (const name of Object.keys(networkInterfaces)) {
      for (const iface of networkInterfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    
    if (ips.length > 0) {
      console.log(`  2. 局域网访问: http://${ips[0]}:${PORT}`);
    }
    
    console.log('\n按 Ctrl+C 停止服务器');
    console.log('='.repeat(50) + '\n');
  });
}

// 启动应用
startServer();

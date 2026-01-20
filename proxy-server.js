/**
 * 本地代理服务器 - 用于绕过CORS限制
 * 使用方法: node proxy-server.js
 * 然后在应用中使用 http://localhost:8080 作为代理
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PROXY_PORT = 8080;
const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

// 创建代理服务器
const server = http.createServer((req, res) => {
    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PROPFIND, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Depth, User-Agent',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    // 记录请求
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);

    // 解析目标URL（从查询参数获取）
    const parsedUrl = url.parse(req.url, true);
    const targetUrl = parsedUrl.query.url;

    if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing target URL. Use ?url=...' }));
        return;
    }

    try {
        const target = new URL(targetUrl);
        const protocol = target.protocol === 'https:' ? https : http;

        // 准备请求选项
        const options = {
            hostname: target.hostname,
            port: target.port || (target.protocol === 'https:' ? 443 : 80),
            path: target.pathname + target.search,
            method: req.method,
            headers: {
                ...req.headers,
                host: target.hostname
            }
        };

        // 移除代理相关的头部
        delete options.headers['host'];
        delete options.headers['connection'];

        // 发起请求到目标服务器
        const proxyReq = protocol.request(options, (proxyRes) => {
            // 设置CORS头部
            const responseHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PROPFIND, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Depth, User-Agent',
                'Access-Control-Expose-Headers': '*'
            };

            // 复制目标服务器的响应头部
            Object.keys(proxyRes.headers).forEach(key => {
                responseHeaders[key] = proxyRes.headers[key];
            });

            res.writeHead(proxyRes.statusCode, responseHeaders);

            proxyRes.pipe(res);
        });

        // 错误处理
        proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err.message);
            res.writeHead(502, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ 
                error: 'Proxy request failed',
                message: err.message 
            }));
        });

        // 如果有请求体，转发它
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE' && req.method !== 'PROPFIND') {
            req.pipe(proxyReq);
        } else {
            proxyReq.end();
        }

    } catch (error) {
        console.error('Invalid URL:', error.message);
        res.writeHead(400, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ 
            error: 'Invalid target URL',
            message: error.message 
        }));
    }
});

// 启动服务器
server.listen(PROXY_PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('本地代理服务器启动成功!');
    console.log('='.repeat(60));
    console.log(`代理地址: http://localhost:${PROXY_PORT}`);
    console.log(`使用方法: 在WebDAV配置中使用代理地址`);
    console.log(`示例: http://localhost:${PROXY_PORT}?url=https://rebun.infini-cloud.net/dav/`);
    console.log('\n按 Ctrl+C 停止服务器');
    console.log('='.repeat(60) + '\n');
});

// 错误处理
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n错误: 端口 ${PROXY_PORT} 已被占用`);
        console.log('请尝试使用其他端口，例如: PORT=8081 node proxy-server.js');
        process.exit(1);
    } else {
        console.error('服务器错误:', err.message);
        process.exit(1);
    }
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭代理服务器...');
    server.close(() => {
        console.log('代理服务器已关闭');
        process.exit(0);
    });
});

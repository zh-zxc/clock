#!/usr/bin/env python3
"""
时钟应用 - Python HTTP 服务器
提供静态文件服务，支持跨域请求
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

# 配置
PORT = 3000
HOST = '0.0.0.0'  # 监听所有网络接口

# 定义支持的MIME类型映射
MIME_TYPES = {
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
}


class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """
    自定义HTTP请求处理器
    支持CORS、自定义MIME类型和优化的响应头
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)
    
    def end_headers(self):
        """添加CORS头和其他优化头"""
        # 启用CORS（跨域资源共享）
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        # 缓存控制（开发环境）
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        
        # 安全头
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        
        super().end_headers()
    
    def guess_type(self, path):
        """根据文件扩展名返回MIME类型"""
        ext = Path(path).suffix.lower()
        return MIME_TYPES.get(ext, super().guess_type(path))
    
    def do_OPTIONS(self):
        """处理OPTIONS请求（预检请求）"""
        self.send_response(200)
        self.end_headers()
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        timestamp = self.log_date_time_string()
        print(f"[{timestamp}] {self.address_string()} - {format % args}")
    
    def handle_one_request(self):
        """处理单个请求，添加异常处理"""
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError):
            # 客户端断开连接，这不是错误
            pass
        except Exception as e:
            print(f"请求处理错误: {e}")
            self.send_error(500, "Internal Server Error")


def main():
    """启动服务器"""
    # 设置当前目录为服务器根目录
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    Handler = CustomHTTPRequestHandler
    
    try:
        with socketserver.TCPServer((HOST, PORT), Handler) as httpd:
            print("\n" + "="*50)
            print("时钟应用服务器启动成功!")
            print("="*50)
            print(f"服务器地址: http://localhost:{PORT}")
            print(f"监听地址: {HOST}")
            print(f"工作目录: {os.getcwd()}")
            print("\n可用的访问方式:")
            print(f"  1. 本地访问: http://localhost:{PORT}")
            print(f"  2. 局域网访问: http://{socketserver.socket.gethostbyname(socketserver.socket.gethostname())}:{PORT}")
            print("\n按 Ctrl+C 停止服务器")
            print("="*50 + "\n")
            
            # 设置服务器超时，提高响应性能
            httpd.timeout = 1
            
            # 启动服务器
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n服务器已停止")
        sys.exit(0)
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"\n错误: 端口 {PORT} 已被占用")
            print("请尝试使用其他端口，例如: python3 server.py 3001")
            sys.exit(1)
        else:
            print(f"\n服务器启动错误: {e}")
            sys.exit(1)
    except Exception as e:
        print(f"\n意外错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    # 支持通过命令行参数指定端口
    if len(sys.argv) > 1:
        try:
            custom_port = int(sys.argv[1])
            if 1024 <= custom_port <= 65535:
                PORT = custom_port
            else:
                print("端口号必须在 1024-65535 范围内")
                sys.exit(1)
        except ValueError:
            print("无效的端口号")
            sys.exit(1)
    
    main()

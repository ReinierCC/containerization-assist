"""
Simple Flask-like application for build testing.
Uses only Python standard library - no external dependencies.
"""
import http.server
import json
import os
from datetime import datetime

PORT = int(os.environ.get('PORT', 8080))
APP_NAME = os.environ.get('APP_NAME', 'python-app')
VERSION = os.environ.get('VERSION', '1.0.0')


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                'status': 'healthy',
                'app': APP_NAME,
                'version': VERSION,
                'timestamp': datetime.now().isoformat()
            }
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                'message': f'Hello from {APP_NAME}!',
                'version': VERSION
            }
            self.wfile.write(json.dumps(response).encode())
    
    def log_message(self, format, *args):
        print(f"[{datetime.now().isoformat()}] {args[0]}")


if __name__ == '__main__':
    server = http.server.HTTPServer(('0.0.0.0', PORT), Handler)
    print(f'{APP_NAME} v{VERSION} running on port {PORT}')
    server.serve_forever()

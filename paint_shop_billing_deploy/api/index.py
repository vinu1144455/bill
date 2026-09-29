import sys
import os

# Ensure the parent directory is in Python module search path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

class VercelPathMiddleware:
    """
    Middleware to normalize PATH_INFO in Vercel serverless environment.
    If Vercel passes /api/index.py, /api/index, or /api as the PATH_INFO,
    this strips the prefix so Flask routes (like '/', '/login', '/billing') match correctly.
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO', '')
        for prefix in ['/api/index.py', '/api/index', '/api']:
            if path == prefix:
                environ['PATH_INFO'] = '/'
                break
            elif path.startswith(prefix + '/'):
                environ['PATH_INFO'] = path[len(prefix):]
                break
        return self.wsgi_app(environ, start_response)

app.wsgi_app = VercelPathMiddleware(app.wsgi_app)

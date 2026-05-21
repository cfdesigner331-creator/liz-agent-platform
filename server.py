import http.server
import socketserver
import mimetypes

PORT = 8500

class FreitasHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Desativa o cache do navegador para facilitar testes em tempo real
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def translate_path(self, path):
        # Registra manualmente os MIME types corretos, ignorando os bugs do registro do Windows
        mimetypes.add_type('text/css', '.css')
        mimetypes.add_type('application/javascript', '.js')
        mimetypes.add_type('image/svg+xml', '.svg')
        mimetypes.add_type('text/html', '.html')
        mimetypes.add_type('image/png', '.png')
        mimetypes.add_type('image/jpeg', '.jpg')
        mimetypes.add_type('image/jpeg', '.jpeg')
        return super().translate_path(path)

# Habilita a reutilização rápida da porta caso o servidor seja reiniciado
socketserver.TCPServer.allow_reuse_address = True

print(f"Iniciando o servidor customizado da Criações Freitas na porta {PORT}...")
try:
    with socketserver.TCPServer(("127.0.0.1", PORT), FreitasHTTPRequestHandler) as httpd:
        print(f"Servidor ONLINE! Abra o seu navegador e acesse: http://localhost:{PORT}")
        httpd.serve_forever()
except Exception as e:
    print(f"Erro ao iniciar o servidor: {e}")

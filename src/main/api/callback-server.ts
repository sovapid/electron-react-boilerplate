import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';

export class CallbackServer {
  private server: any = null;
  private port: number = 8080;

  /**
   * Start a local HTTP server to handle OAuth callbacks
   */
  public startServer(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a simple HTTP server
      this.server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '', `http://localhost:${this.port}`);

        if (url.pathname === '/auth/callback') {
          // Handle the OAuth callback
          const callbackUrl = `http://localhost:${this.port}${req.url}`;

          // Send a success page
          const successHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>EVE Online Authentication</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  text-align: center;
                  padding: 50px;
                  background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
                  color: white;
                  margin: 0;
                }
                .container {
                  max-width: 500px;
                  margin: 0 auto;
                  background: #333;
                  padding: 40px;
                  border-radius: 10px;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                }
                .success-icon {
                  font-size: 64px;
                  color: #28a745;
                  margin-bottom: 20px;
                }
                h1 {
                  color: #28a745;
                  margin-bottom: 20px;
                }
                p {
                  font-size: 16px;
                  line-height: 1.5;
                  margin: 10px 0;
                }
                .close-note {
                  margin-top: 30px;
                  font-style: italic;
                  color: #ccc;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="success-icon">✓</div>
                <h1>Authentication Successful!</h1>
                <p>Your EVE Online character has been successfully authenticated.</p>
                <p>You can now close this browser window and return to the application.</p>
                <div class="close-note">
                  This window will close automatically in 5 seconds...
                </div>
              </div>
              <script>
                setTimeout(() => {
                  window.close();
                }, 5000);
              </script>
            </body>
            </html>
          `;

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(successHtml);

          // Resolve with the callback URL
          resolve(callbackUrl);

          // Close the server after a short delay
          setTimeout(() => {
            this.stopServer();
          }, 6000);

        } else {
          // Handle other requests
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      // Handle server errors
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`Port ${this.port} is in use, trying ${this.port + 1}`);
          this.port++;
          this.server.listen(this.port, 'localhost');
        } else {
          reject(error);
        }
      });

      // Start listening
      this.server.listen(this.port, 'localhost', () => {
        console.log(`Callback server started on http://localhost:${this.port}`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        this.stopServer();
        reject(new Error('Authentication timeout - no callback received'));
      }, 300000);
    });
  }

  /**
   * Stop the callback server
   */
  public stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      console.log('Callback server stopped');
    }
  }

  /**
   * Get the current callback URL
   */
  public getCallbackUrl(): string {
    return `http://localhost:${this.port}/auth/callback`;
  }
}

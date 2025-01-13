const http = require('http');
const ngrok = require('@ngrok/ngrok');

// Create webserver
http.createServer((req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end('Congrats you have created an ngrok web server');
}).listen(8080, () => console.log('Node.js web server at 8080 is running...'));

// Get your endpoint online
ngrok.connect({ addr: 8080, authtoken_from_env: true })
	.then(listener => console.log(`Ingress established at: ${listener.url()}`));

const http = require('http');
const ngrok = require('@ngrok/ngrok');
	
// Hardcode the NGROK authtoken
const NGROK_AUTHTOKEN = '';
	
// Create webserver
const server = http.createServer((req, res) => {
    if (req.method === 'POST') {
        let body = '';

        // Collect data chunks
        req.on('data', chunk => {
            body += chunk.toString();
        });

        // Handle the end of the data stream
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                console.log('Received webhook data:', data);

                // Check if the producer field matches the expected value
                if (data.producer === 'stores/m8e2dlatqv') {
                    // Respond with 200 OK
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success' }));
                } else {
                    // Respond with 400 Bad Request if the producer field does not match
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', message: 'Invalid producer' }));
                }
            } catch (error) {
                // Respond with 400 Bad Request if the JSON is invalid
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
            }
        });
    } else {
        // Respond with 404 Not Found for other routes
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// Start the server
const port = 8080;
server.listen(port, () => {
    console.log(`Node.js web server at ${port} is running...`);

    // Get your endpoint online
    ngrok.connect({ addr: port, authtoken: NGROK_AUTHTOKEN })
        .then(listener => {
            console.log(`Ingress established at: ${listener.url()}`);
        })
        .catch(error => {
            console.error('Failed to connect NGROK:', error);
        });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});


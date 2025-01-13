const http = require('http');
const ngrok = require('@ngrok/ngrok');

import dotenv from 'dotenv';

// Load environment variables from a .env file
dotenv.config();

// Use environment variables for sensitive information
const NGROK_AUTHTOKEN = process.env.NGROK_AUTHTOKEN;
const BIGCOMMERCE_API_ACCESS_TOKEN = process.env.BIGCOMMERCE_API_ACCESS_TOKEN;
const BIGCOMMERCE_API_STORE_HASH = process.env.BIGCOMMERCE_API_STORE_HASH;
const INDEX_NOW_API_KEY = process.env.INDEX_NOW_API_KEY;
const INDEX_NOW_KEY_LOCATION_URL = process.env.INDEX_NOW_KEY_LOCATION_URL;
const BASE_URL = process.env.BASE_URL; 


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


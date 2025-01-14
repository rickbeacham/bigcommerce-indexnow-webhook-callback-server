// index.js
import http from 'http';
import ngrok from '@ngrok/ngrok';
import dotenv from 'dotenv';
import { submitToIndexNow, getCategoryUrlById, getProductUrlById, getPageUrlById } from './services.js';
import { validateEnvVariables, logError, logInfo } from './utils.js';
import { Webhook } from 'standardwebhooks';

// Load environment variables from a .env file
dotenv.config();

// Validate environment variables
const requiredEnvVars = [
    'NGROK_AUTHTOKEN',
    'BIGCOMMERCE_API_ACCESS_TOKEN',
    'BIGCOMMERCE_API_CLIENT_SECRET',
    'BIGCOMMERCE_API_STORE_HASH',
    'INDEX_NOW_API_KEY',
    'INDEX_NOW_KEY_LOCATION_URL',
    'BASE_URL',
    'BIGCOMMERCE_WEBHOOK_AUTHORIZATION'
];
validateEnvVariables(requiredEnvVars);

const {
    NGROK_AUTHTOKEN,
    BIGCOMMERCE_API_ACCESS_TOKEN,
    BIGCOMMERCE_API_STORE_HASH,
    INDEX_NOW_API_KEY,
    INDEX_NOW_KEY_LOCATION_URL,
    BASE_URL,
    BIGCOMMERCE_WEBHOOK_AUTHORIZATION,
    BIGCOMMERCE_API_CLIENT_SECRET
} = process.env;

const encodedClientSecret = Buffer.from(BIGCOMMERCE_API_CLIENT_SECRET).toString('base64');

// In-memory blocklist to store hashes of processed webhooks
const processedWebhookHashes = new Set();
const BLOCKLIST_EXPIRY_MS = 60 * 1000; // Keep hashes for 60 seconds

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST') {
        const authHeader = req.headers.authorization;
        if (authHeader !== BIGCOMMERCE_WEBHOOK_AUTHORIZATION) {
            logError('Unauthorized webhook request received. Invalid Authorization header.');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Unauthorized' }));
            return;
        }

        let body = '';
        for await (const chunk of req) {
            body += chunk.toString();
        }

        try {
            const webhookHeaders = req.headers;
            const webhookPayload = body;

            // Verify the webhook signature
            const wh = new Webhook(encodedClientSecret);
            const isValid = wh.verify(webhookPayload, webhookHeaders);
            if (!isValid) {
                logError('Invalid webhook signature.');
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Invalid webhook signature' }));
                return;
            }

            const data = JSON.parse(webhookPayload);

            if (data && data.hash && processedWebhookHashes.has(data.hash)) {
                logInfo(`Duplicate webhook received (hash: ${data.hash}, scope: ${data.scope}). Ignoring.`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', message: 'Duplicate ignored' }));
                return;
            }

            logInfo(`Received webhook event (scope: ${data.scope}):`, data);
            let submittedUrls = [];

            switch (data.scope) {
                case 'store/category/created':
                case 'store/category/updated':
                case 'store/category/metafield/created':
                case 'store/category/metafield/deleted':
                case 'store/category/metafield/updated':
                case 'store/category/deleted':
                    try {
                        const categoryId = data.scope.includes('metafield') ? data.context.category_id : data.data.id;
                        const categoryUrl = await getCategoryUrlById(categoryId, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN, BASE_URL);
                        logInfo('Category URL:', categoryUrl);
                        submittedUrls.push(categoryUrl);
                    } catch (error) {
                        logError('Error getting category URL:', error);
                    }
                    break;
                case 'store/product/created':
                case 'store/product/updated':
                case 'store/product/deleted':
                    try {
                        const productUrl = await getProductUrlById(data.data.id, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN, BASE_URL);
                        logInfo('Product URL:', productUrl);
                        submittedUrls.push(productUrl);
                    } catch (error) {
                        logError('Error getting product URL:', error);
                    }
                    break;

                case 'store/channel/1/page/updated/created':
                case 'store/channel/1/page/updated':
                    try {
                        const pageUrl = await getPageUrlById(data.resource_id, BIGCOMMERCE_API_STORE_HASH, BIGCOMMERCE_API_ACCESS_TOKEN, BASE_URL);
                        logInfo('Page URL:', pageUrl);
                        submittedUrls.push(pageUrl);
                    } catch (error) {
                        logError('Error getting page URL:', error);
                    }
                    break;
                default:
                    logError('Unknown webhook scope received:', data.scope);
                    break;
            }

            if (submittedUrls.length > 0) {
                await submitToIndexNow(submittedUrls, INDEX_NOW_API_KEY, INDEX_NOW_KEY_LOCATION_URL, BASE_URL);
            }

            if (data && data.hash) {
                processedWebhookHashes.add(data.hash);
                setTimeout(() => {
                    processedWebhookHashes.delete(data.hash);
                    logInfo(`Removed webhook hash from blocklist: ${data.hash}`);
                }, BLOCKLIST_EXPIRY_MS);
            } else {
                logError('Webhook received without a hash. Unable to perform duplicate check.');
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success' }));

        } catch (error) {
            logError('Error processing webhook:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
        }
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const port = 8080;
server.listen(port, async () => {
    logInfo(`Node.js web server at ${port} is running...`);

    try {
        const listener = await ngrok.connect({ addr: port, authtoken: NGROK_AUTHTOKEN });
        logInfo(`Ingress established at: ${listener.url()}`);
    } catch (error) {
        logError('Failed to connect NGROK:', error);
    }
});

process.on('SIGINT', () => {
    logInfo('Shutting down gracefully...');
    server.close(() => {
        logInfo('Server closed');
        process.exit(0);
    });
});
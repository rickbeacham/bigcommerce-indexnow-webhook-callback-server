// index.js
import http from 'http';
import ngrok from '@ngrok/ngrok';
import dotenv from 'dotenv';
import { submitToIndexNow, getCategoryUrlById, getProductUrlById, getPageUrlById } from './services.js';
import { validateEnvVariables, logError, logInfo } from './utils.js';

// Load environment variables from a .env file
dotenv.config();

// Validate environment variables
const requiredEnvVars = [
    'NGROK_AUTHTOKEN',
    'BIGCOMMERCE_API_ACCESS_TOKEN',
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
    BIGCOMMERCE_WEBHOOK_AUTHORIZATION
} = process.env;

// Export the env object
export const env = {
    NGROK_AUTHTOKEN,
    BIGCOMMERCE_API_ACCESS_TOKEN,
    BIGCOMMERCE_API_STORE_HASH,
    INDEX_NOW_API_KEY,
    INDEX_NOW_KEY_LOCATION_URL,
    BASE_URL,
    BIGCOMMERCE_WEBHOOK_AUTHORIZATION
};

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
            const data = JSON.parse(body);

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
                    try {
                        const categoryId = data.scope.includes('metafield') ? data.context.category_id : data.data.id;
                        const categoryUrl = await getCategoryUrlById(categoryId);
                        logInfo('Category URL:', categoryUrl);
                        submittedUrls.push(categoryUrl);
                    } catch (error) {
                        logError('Error getting category URL:', error);
                    }
                    break;
                case 'store/category/deleted':
                    logInfo(`Deleted Category ID: ${data.data.id}`);
                    break;
                case 'store/product/created':
                case 'store/product/updated':
                    try {
                        const productUrl = await getProductUrlById(data.data.id);
                        logInfo('Product URL:', productUrl);
                        submittedUrls.push(productUrl);
                    } catch (error) {
                        logError('Error getting product URL:', error);
                    }
                    break;
                case 'store/product/deleted':
                    logInfo(`Deleted Product ID: ${data.data.id}`);
                    break;
                case 'store/channel/page/created':
                case 'store/channel/page/updated':
                    try {
                        const pageUrl = await getPageUrlById(data.resource_id);
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
                await submitToIndexNow(submittedUrls);
            }
            
            // Memory Leaks... 
            
            /* 
            Set for setTimeout - 
            Sets only store unique values and provide 
            efficient add and has operations. The Set itself doesn't inherently 
            cause memory leaks if items are properly removed.
            */

            /*  
            setTimeout for Expiry -  
            setTimeout is the standard way to schedule a function 
            to be executed after a delay in JavaScript. In this case, it's used to schedule 
            the removal of a webhook hash from the processedWebhookHashes set.
            */  
           
            /* 
            Closure over data.hash - 
            The setTimeout creates a closure over the data.hash value 
            at the time the setTimeout function is called. This ensures that even if the original 
            data object changes or goes out of scope, the correct hash value is used when 
            processedWebhookHashes.delete(data.hash) is executed. 
            */

            /* 
            NOTICE: Why This Implementation Is Likely Memory-Safe 
            Explicit Removal - 
            The code explicitly removes the hash from the processedWebhookHashes
            set using processedWebhookHashes.delete(data.hash) after the specified BLOCKLIST_EXPIRY_MS.
            Set Behavior: The delete() method of a Set removes the element if it exists. Attempting to 
            delete a non-existent element has no adverse effect. No Unbounded Growth: As long as the 
            setTimeout callbacks are executed (which is the normal behavior of Node.js event loop), 
            the processedWebhookHashes set should not grow indefinitely. Hashes are added when a new 
            webhook is processed and removed after their expiry time.
            */ 

            /* 
            Potential (Minor) Considerations -
            System Clock Changes: If the system clock is significantly altered backward, the setTimeout 
            might execute earlier than expected. However, this is an edge case and not a memory leak issue.
            High Volume of Unique Webhooks: If you receive a very high volume of unique webhooks within a 
            short time, the processedWebhookHashes set might temporarily grow large. This isn't a leak but 
            could be a performance consideration if the memory usage becomes excessive. 
            The BLOCKLIST_EXPIRY_MS helps to manage this.
            */
           
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
// index.js
import http from 'http';
import ngrok from '@ngrok/ngrok';
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

if (!NGROK_AUTHTOKEN) {
    throw new Error('NGROK_AUTHTOKEN is not defined in the environment variables.');
}
if (!BIGCOMMERCE_API_ACCESS_TOKEN) {
    throw new Error('BIGCOMMERCE_API_ACCESS_TOKEN is not defined in the environment variables.');
}
if (!BIGCOMMERCE_API_STORE_HASH) {
    throw new Error('BIGCOMMERCE_API_STORE_HASH is not defined in the environment variables.');
}
if (!INDEX_NOW_API_KEY) {
    throw new Error('INDEX_NOW_API_KEY is not defined in the environment variables.');
}
if (!INDEX_NOW_KEY_LOCATION_URL) {
    throw new Error('INDEX_NOW_KEY_LOCATION_URL is not defined in the environment variables.');
}
if (!BASE_URL) {
    throw new Error('BASE_URL is not defined in the environment variables.');
}


console.log("Store Hash:", BIGCOMMERCE_API_STORE_HASH);
console.log("Access Token:", BIGCOMMERCE_API_ACCESS_TOKEN);
console.log("IndexNow API Key:", INDEX_NOW_API_KEY);
console.log("IndexNow Key Location URL:", INDEX_NOW_KEY_LOCATION_URL);
console.log("IndexNow BASE URL:", BASE_URL);

// Dynamically import node-fetch
const fetch = (await import('node-fetch')).default;


// Function to submit URLs to IndexNow
async function submitToIndexNow(urlList, apiKey, baseUrl, keyLocationUrl) {
    // 1. Input Validation
    if (!Array.isArray(urlList) || urlList.length === 0) {
        console.warn("Invalid or empty URL list provided. Skipping IndexNow submission.");
        return false;
    }

    // 2. Dependency Check (API Key is the most crucial)
    if (!apiKey) {
        console.warn("IndexNow API key is not defined. Skipping IndexNow submission.");
        return false;
    }

    try {
        const payload = {
            host: new URL(baseUrl).hostname,
            key: apiKey,
            keyLocation: keyLocationUrl,
            urlList: urlList
        };

        const response = await fetch('https://api.indexnow.org/IndexNow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        // 3. Refined Error Handling and Return Value
        if (response.ok) {
            console.log('Successfully submitted to IndexNow:', urlList);
            return true;
        } else {
            console.error('Error submitting to IndexNow:', response.status, response.statusText);
            const responseBody = await response.text();
            console.error('IndexNow Response Body:', responseBody);

            // More specific error logging based on status code
            if (response.status === 400) {
                console.error("Possible reasons: Invalid API key, incorrect URL format, exceeding URL limit.");
            } else if (response.status === 403) {
                console.error("Forbidden. Ensure your API key is valid and correctly configured.");
            } else if (response.status === 422) {
                console.error("Unprocessable Entity. In case of URLs don’t belong to the host or the key is not matching the schema in the protocol.");
            } else if (response.status === 429) {
                console.error("Too Many Requests. You might be hitting the rate limit.");
            }
            return false;
        }
    } catch (error) {
        console.error('Error submitting to IndexNow:', error);
        return false;
    }
}



// Function to get category URL by ID using node-fetch
async function getCategoryUrlById(categoryId) {
    const url = `https://api.bigcommerce.com/stores/${BIGCOMMERCE_API_STORE_HASH}/v3/catalog/categories/${categoryId}`;

    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Auth-Token': BIGCOMMERCE_API_ACCESS_TOKEN
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const category = await response.json();
        const urlPath = category.data.custom_url.url; // Access the URL from the custom_url object
        const fullUrl = `${BASE_URL}${urlPath}`;
        console.log('Get Category URL by ID = ', fullUrl);
        return fullUrl;
    } catch (error) {
        console.error('Error fetching category:', error);
        throw error;
    }
}

// Function to get product URL by ID using node-fetch
async function getProductUrlById(productId) {
    const url = `https://api.bigcommerce.com/stores/${BIGCOMMERCE_API_STORE_HASH}/v3/catalog/products/${productId}`;
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Auth-Token': BIGCOMMERCE_API_ACCESS_TOKEN
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const product = await response.json();
        const urlPath = product.data.custom_url.url; // Access the URL from the response data
        const fullUrl = `${BASE_URL}${urlPath}`;
        return fullUrl;
    } catch (error) {
        console.error('Error fetching product:', error);
        throw error;
    }
}

// Function to get page URL by ID using node-fetch
async function getPageUrlById(pageId) {
    const url = `https://api.bigcommerce.com/stores/${BIGCOMMERCE_API_STORE_HASH}/v3/content/pages/${pageId}`;
    const options = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Auth-Token': BIGCOMMERCE_API_ACCESS_TOKEN
        }
    };

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const page = await response.json();
        const urlPath = page.data.url; // Access the URL from the response data
        const fullUrl = `${BASE_URL}${urlPath}`;
        return fullUrl;
    } catch (error) {
        console.error('Error fetching page:', error);
        throw error;
    }
}

// In-memory blocklist to store hashes of processed webhooks
const processedWebhookHashes = new Set();
const BLOCKLIST_EXPIRY_MS = 60 * 1000; // Example: Keep hashes for 60 seconds

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST') {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const data = JSON.parse(body);

                // Check if the webhook has already been processed using BigCommerce's hash
                if (data && data.hash && processedWebhookHashes.has(data.hash) && data.producer === `stores/${BIGCOMMERCE_API_STORE_HASH}`) {
                    console.log(`Duplicate webhook received (hash: ${data.hash}, scope: ${data.scope}). Ignoring.`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'success', message: 'Duplicate ignored' }));
                    return; // Stop processing
                }

                console.log(`Received webhook event (scope: ${data.scope}):`, data);
                let submittedUrls = [];

                // **CHECK THE WEBHOOK SCOPE AND HANDLE ACCORDINGLY**
                switch (data.scope) {
                    // Categories
                    case 'store/category/created':
                        console.log('New category created:', data.data);
                        try {
                            const categoryUrl = await getCategoryUrlById(data.data.id);
                            console.log('Category URL:', categoryUrl);
                            submittedUrls.push(categoryUrl);
                        } catch (error) {
                            console.error('Error getting category URL:', error);
                        }
                        break;
                    case 'store/category/updated':
                        console.log('Category updated:', data.data);
                        try {
                            const categoryUrl = await getCategoryUrlById(data.data.id);
                            console.log('Category URL:', categoryUrl);
                            submittedUrls.push(categoryUrl);
                        } catch (error) {
                            console.error('Error getting category URL:', error);
                        }
                        break;
                    case 'store/category/deleted':
                        console.log('Category deleted:', data.data);
                        // Perform actions for category deletion here
                        console.log(`Deleted Category ID: ${data.data.id}`);
                        // Consider submitting the URL for deletion to IndexNow if needed.
                        break;
                    case 'store/category/metafield/created':
                        console.log('Category metafield created:', data.data);
                        try {
                            const categoryUrl = await getCategoryUrlById(data.context.category_id);
                            console.log('Category URL:', categoryUrl);
                            submittedUrls.push(categoryUrl);
                        } catch (error) {
                            console.error('Error getting category URL:', error);
                        }
                        break;
                    case 'store/category/metafield/deleted':
                        console.log('Category metafield deleted:', data.data);
                        try {
                            const categoryUrl = await getCategoryUrlById(data.context.category_id);
                            console.log('Category URL:', categoryUrl);
                            submittedUrls.push(categoryUrl);
                        } catch (error) {
                            console.error('Error getting category URL:', error);
                        }
                        break;
                    case 'store/category/metafield/updated':
                        console.log('Category metafield updated:', data.data);
                        try {
                            const categoryUrl = await getCategoryUrlById(data.context.category_id);
                            console.log('Category URL:', categoryUrl);
                            submittedUrls.push(categoryUrl);
                        } catch (error) {
                            console.error('Error getting category URL:', error);
                        }
                        break;

                    // Products
                    case 'store/product/deleted':
                        console.log('Product deleted:', data.data);
                        // Perform actions for product deletion here
                        // Consider submitting the URL for deletion to IndexNow if needed.
                        break;
                    case 'store/product/created':
                        console.log('New product created:', data.data);
                        try {
                            const productUrl = await getProductUrlById(data.data.id);
                            console.log('Product URL:', productUrl);
                            submittedUrls.push(productUrl);
                        } catch (error) {
                            console.error('Error getting product URL:', error);
                        }
                        break;
                    case 'store/product/updated':
                        console.log('Product updated:', data.data);
                        try {
                            const productUrl = await getProductUrlById(data.data.id);
                            console.log('Product URL:', productUrl);
                            submittedUrls.push(productUrl);
                        } catch (error) {
                            console.error('Error getting product URL:', error);
                        }
                        break;

                    // Pages
                    case 'store/channel/page/created':
                        console.log('Page created:', data);
                        try {
                            const pageUrl = await getPageUrlById(data.resource_id);
                            console.log('Page URL:', pageUrl);
                            submittedUrls.push(pageUrl);
                        } catch (error) {
                            console.error('Error getting page URL:', error);
                        }
                        break;
                    case 'store/channel/page/updated':
                        console.log('Page updated:', data);
                        try {
                            const pageUrl = await getPageUrlById(data.resource_id);
                            console.log('Page URL:', pageUrl);
                            submittedUrls.push(pageUrl);
                        } catch (error) {
                            console.error('Error getting page URL:', error);
                        }
                        break;

                    default:
                        console.warn('Unknown webhook scope received:', data.scope);
                        // Handle unknown webhook types appropriately
                        break;
                }

                // Submit URLs to IndexNow if any were generated
                if (submittedUrls.length > 0) {
                    await submitToIndexNow(submittedUrls, INDEX_NOW_API_KEY, BASE_URL, INDEX_NOW_KEY_LOCATION_URL);
                }

                // Add BigCommerce's hash to the processed list
                if (data && data.hash) {
                    processedWebhookHashes.add(data.hash);

                    // Remove the hash after a certain time to prevent the list from growing indefinitely
                    setTimeout(() => {
                        processedWebhookHashes.delete(data.hash);
                        console.log(`Removed webhook hash from blocklist: ${data.hash}`);
                    }, BLOCKLIST_EXPIRY_MS);
                } else {
                    console.warn('Webhook received without a hash. Unable to perform duplicate check.');
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success' }));

            } catch (error) {
                console.error('Error processing webhook:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const port = 8080;
server.listen(port, async () => {
    console.log(`Node.js web server at ${port} is running...`);

    try {
        const listener = await ngrok.connect({ addr: port, authtoken: NGROK_AUTHTOKEN });
        console.log(`Ingress established at: ${listener.url()}`);
    } catch (error) {
        console.error('Failed to connect NGROK:', error);
    }
});

process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});                                                                                                

/**
 * whatsapp.js — WhatsApp Business Cloud API Service
 * Uses Meta's official Graph API v18.0
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Functions:
 *   formatPhone          — normalize phone to E.164 digits
 *   sendTextMessage      — send plain text
 *   sendTemplateMessage  — send an approved template message
 *   uploadMedia          — upload a file to Meta, returns media_id
 *   sendMediaMessage     — send image / video / audio via media_id or URL
 *   testConnection       — validate credentials
 *   sendCampaign         — batch send with delay + retry on 429
 */

const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');
const FormData = require('form-data');

const WA_API_VERSION = 'v18.0';
const WA_BASE_URL    = `https://graph.facebook.com/${WA_API_VERSION}`;

// Maximum retries on rate-limit (HTTP 429) or transient server errors (500/503)
const MAX_RETRIES    = 3;
const RETRY_BASE_MS  = 2000; // 2 s, doubles each attempt

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sleep helper.
 * @param {number} ms
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Parse a clean error message from an Axios error.
 * @param {import('axios').AxiosError} err
 * @returns {string}
 */
function parseError(err) {
    const e = err.response?.data?.error;
    if (e) return `[${e.code}] ${e.message}`;
    return err.message;
}

/**
 * Execute an async API call with automatic retry on 429 / 5xx.
 * @param {() => Promise<any>} fn   - The async call to attempt
 * @param {number} retries          - Retries remaining
 * @returns {Promise<any>}
 */
async function withRetry(fn, retries = MAX_RETRIES) {
    let attempt = 0;
    while (true) {
        try {
            return await fn();
        } catch (err) {
            const status = err.response?.status;
            const isRetryable = status === 429 || status === 500 || status === 503;

            if (isRetryable && attempt < retries) {
                const wait = RETRY_BASE_MS * Math.pow(2, attempt); // exponential backoff
                const retryAfter = err.response?.headers?.['retry-after'];
                const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : wait;
                console.warn(`[WA] Rate-limited (${status}). Retry ${attempt + 1}/${retries} in ${delay}ms…`);
                await sleep(delay);
                attempt++;
            } else {
                throw err;
            }
        }
    }
}

// ─── Phone Formatter ──────────────────────────────────────────────────────────
/**
 * Normalize a phone number to WhatsApp format (digits only, international).
 * Examples:
 *   "+212 6 12 34 56 78"  → "212612345678"
 *   "0612345678"          → "212612345678"  (Moroccan fallback)
 *   "+1 (555) 123-4567"   → "15551234567"
 */
function formatPhone(raw) {
    let digits = String(raw).replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    // Moroccan 0-prefix → 212
    if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 11) {
        digits = '212' + digits.slice(1);
    }
    return digits;
}

// ─── Send Text Message ────────────────────────────────────────────────────────
/**
 * Send a plain text WhatsApp message.
 * @param {string} phone
 * @param {string} message
 * @param {string} token
 * @param {string} phoneNumberId
 * @returns {Promise<{success, messageId, to, error?}>}
 */
async function sendTextMessage(phone, message, token, phoneNumberId) {
    const to = formatPhone(phone);
    try {
        const response = await withRetry(() =>
            axios.post(
                `${WA_BASE_URL}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type:    'individual',
                    to,
                    type: 'text',
                    text: { preview_url: false, body: message }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type':  'application/json'
                    },
                    timeout: 10000
                }
            )
        );
        const messageId = response.data?.messages?.[0]?.id || null;
        return { success: true, messageId, to };
    } catch (err) {
        return { success: false, to, error: parseError(err) };
    }
}

// ─── Send Template Message ────────────────────────────────────────────────────
/**
 * Send an approved WhatsApp Template message.
 * Templates are required for Marketing, Utility, Authentication categories.
 *
 * @param {string} phone
 * @param {string} templateName   - Exact template name as approved in Meta Business Manager
 * @param {string} languageCode   - e.g. 'en_US', 'fr', 'ar'
 * @param {Array}  components     - Template components (header, body, buttons), can be []
 *   Example body component with variable:
 *   [{ type: 'body', parameters: [{ type: 'text', text: 'John' }] }]
 * @param {string} token
 * @param {string} phoneNumberId
 * @returns {Promise<{success, messageId, to, error?}>}
 */
async function sendTemplateMessage(phone, templateName, languageCode = 'en_US', components = [], token, phoneNumberId) {
    const to = formatPhone(phone);
    try {
        const response = await withRetry(() =>
            axios.post(
                `${WA_BASE_URL}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type:    'individual',
                    to,
                    type: 'template',
                    template: {
                        name:     templateName,
                        language: { code: languageCode },
                        ...(components.length > 0 && { components })
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type':  'application/json'
                    },
                    timeout: 10000
                }
            )
        );
        const messageId = response.data?.messages?.[0]?.id || null;
        return { success: true, messageId, to };
    } catch (err) {
        return { success: false, to, error: parseError(err) };
    }
}

// ─── Upload Media ─────────────────────────────────────────────────────────────
/**
 * Upload a media file to Meta's servers and get a reusable media_id.
 * Preferred over URL links — faster delivery and doesn't expose public URLs.
 *
 * @param {string} filePath       - Absolute path to the file on disk
 * @param {string} mimeType       - MIME type e.g. 'image/jpeg', 'video/mp4'
 * @param {string} token
 * @param {string} phoneNumberId
 * @returns {Promise<{success, mediaId, error?}>}
 */
async function uploadMedia(filePath, mimeType, token, phoneNumberId) {
    try {
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('type', mimeType);
        form.append('file', fs.createReadStream(filePath), {
            filename:    path.basename(filePath),
            contentType: mimeType
        });

        const response = await withRetry(() =>
            axios.post(
                `${WA_BASE_URL}/${phoneNumberId}/media`,
                form,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        ...form.getHeaders()
                    },
                    timeout: 30000 // 30s for large files
                }
            )
        );

        const mediaId = response.data?.id || null;
        return { success: true, mediaId };
    } catch (err) {
        return { success: false, error: parseError(err) };
    }
}

// ─── Send Media Message ───────────────────────────────────────────────────────
/**
 * Send image / video / audio using either a media_id (preferred) or a URL.
 *
 * @param {string} phone
 * @param {string} mediaIdOrUrl   - Either a Meta media_id or a public URL
 * @param {'image'|'video'|'audio'|'document'} type
 * @param {string} caption        - Optional caption (image / video only)
 * @param {string} token
 * @param {string} phoneNumberId
 * @returns {Promise<{success, messageId, to, error?}>}
 */
async function sendMediaMessage(phone, mediaIdOrUrl, type, caption, token, phoneNumberId) {
    const to = formatPhone(phone);

    // Determine if it's a media_id (digits only) or a URL
    const isMediaId = /^\d+$/.test(String(mediaIdOrUrl));
    const mediaKey  = isMediaId ? 'id' : 'link';

    let mediaPayload;
    if (type === 'image') {
        mediaPayload = { image: { [mediaKey]: mediaIdOrUrl, caption: caption || '' } };
    } else if (type === 'video') {
        mediaPayload = { video: { [mediaKey]: mediaIdOrUrl, caption: caption || '' } };
    } else if (type === 'audio') {
        mediaPayload = { audio: { [mediaKey]: mediaIdOrUrl } };
    } else {
        mediaPayload = { document: { [mediaKey]: mediaIdOrUrl, caption: caption || '' } };
    }

    try {
        const response = await withRetry(() =>
            axios.post(
                `${WA_BASE_URL}/${phoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type:    'individual',
                    to,
                    type,
                    ...mediaPayload
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type':  'application/json'
                    },
                    timeout: 15000
                }
            )
        );
        const messageId = response.data?.messages?.[0]?.id || null;
        return { success: true, messageId, to };
    } catch (err) {
        return { success: false, to, error: parseError(err) };
    }
}

// ─── Test Connection ──────────────────────────────────────────────────────────
/**
 * Validate credentials by fetching phone number metadata from Meta.
 * @param {string} token
 * @param {string} phoneNumberId
 * @returns {Promise<{success, displayName, phoneNumber, status, quality, error?}>}
 */
async function testConnection(token, phoneNumberId) {
    try {
        const response = await axios.get(
            `${WA_BASE_URL}/${phoneNumberId}`,
            {
                params:  { fields: 'display_phone_number,verified_name,status,quality_rating' },
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 8000
            }
        );
        const d = response.data;
        return {
            success:     true,
            displayName: d.verified_name         || 'Unknown',
            phoneNumber: d.display_phone_number  || phoneNumberId,
            status:      d.status                || 'CONNECTED',
            quality:     d.quality_rating        || 'N/A'
        };
    } catch (err) {
        return { success: false, error: parseError(err) };
    }
}

// ─── Send Campaign (batch with delay + retry) ─────────────────────────────────
/**
 * Send a campaign to a list of customers.
 * Skips Opt-out customers.
 * Supports text, media, and template messages.
 * Retries on rate-limit per-message (via withRetry inside each send fn).
 *
 * @param {Array<{id, phone, name, status?}>} customers
 * @param {string} message                   - Text body (also used as template caption)
 * @param {Array<{url, type, mediaId?}>} media - Optional media list
 * @param {string} token
 * @param {string} phoneNumberId
 * @param {number} delayMs                   - Delay between messages in ms (default 1000)
 * @param {Function|null} onProgress         - Called after each message with result
 * @param {object|null} template             - If set: { name, language, components }
 * @returns {Promise<{sent, failed, skipped, results}>}
 */
async function sendCampaign(
    customers,
    message,
    media,
    token,
    phoneNumberId,
    delayMs   = 1000,
    onProgress = null,
    template   = null
) {
    const results = [];
    let sent    = 0;
    let failed  = 0;
    let skipped = 0;

    for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];

        // ── Skip opted-out customers ──────────────────────────────────────
        if (customer.status === 'Opt-out') {
            skipped++;
            const skipResult = {
                success:      false,
                skipped:      true,
                customerId:   customer.id,
                customerName: customer.name,
                to:           formatPhone(customer.phone),
                error:        'Skipped — customer opted out'
            };
            results.push(skipResult);
            if (onProgress) onProgress(skipResult);
            continue;
        }

        let result;

        if (template) {
            // ── Template message ──────────────────────────────────────────
            result = await sendTemplateMessage(
                customer.phone,
                template.name,
                template.language || 'en_US',
                template.components || [],
                token,
                phoneNumberId
            );
        } else if (media && media.length > 0) {
            // ── Media message (use mediaId if available, else URL) ────────
            const firstMedia = media[0];
            const mediaRef   = firstMedia.mediaId || firstMedia.url;
            result = await sendMediaMessage(
                customer.phone,
                mediaRef,
                firstMedia.type,
                message,
                token,
                phoneNumberId
            );
        } else {
            // ── Plain text ────────────────────────────────────────────────
            result = await sendTextMessage(customer.phone, message, token, phoneNumberId);
        }

        result.customerId   = customer.id;
        result.customerName = customer.name;

        if (result.success) sent++;
        else failed++;

        results.push(result);
        if (onProgress) onProgress(result);

        // Delay between messages (skip after last)
        if (i < customers.length - 1) {
            await sleep(delayMs);
        }
    }

    return { sent, failed, skipped, results };
}

module.exports = {
    formatPhone,
    sendTextMessage,
    sendTemplateMessage,
    uploadMedia,
    sendMediaMessage,
    testConnection,
    sendCampaign
};

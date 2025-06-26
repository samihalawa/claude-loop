// Test XSS sanitization logic
const sanitizeObject = (obj) => {
    for (const key in obj) {
        if (typeof obj[key] === 'string') {
            const originalLength = obj[key].length;
            
            // XSS prevention patterns
            obj[key] = obj[key]
                .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
                .replace(/javascript:/gi, '') // Remove javascript: protocol
                .replace(/on\w+\s*=/gi, '') // Remove event handlers
                .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
                .replace(/<object[^>]*>.*?<\/object>/gi, '') // Remove objects
                .replace(/<embed[^>]*>/gi, '') // Remove embeds
                .replace(/data:/gi, '') // Remove data URLs
                .replace(/vbscript:/gi, '') // Remove vbscript
                .substring(0, 1000); // Limit string length
            
            // Log if content was sanitized
            if (obj[key].length !== originalLength) {
                console.log(`Sanitized XSS content in field '${key}': ${originalLength} -> ${obj[key].length} chars`);
            }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursively sanitize nested objects
            obj[key] = sanitizeObject(obj[key]);
        }
    }
    return obj;
};

const testData = { data: '<script>alert("xss")</script>' };
console.log('Original:', testData);
const sanitized = sanitizeObject(JSON.parse(JSON.stringify(testData)));
console.log('Sanitized:', sanitized);
console.log('Has data field:', !!sanitized.data);
console.log('Data field length:', sanitized.data.length);
console.log('Data field content:', JSON.stringify(sanitized.data));
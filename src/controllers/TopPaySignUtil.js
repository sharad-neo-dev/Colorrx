import crypto from "crypto";
import https from "https";


class TopPaySignUtil {
    static MAX_ENCRYPT_BLOCK = 245;  


    static encrypt(plainData, privateKeyPem) {
        try {
            const dataBuffer = Buffer.from(plainData, 'utf8');
            const encryptedChunks = [];

            // 1. 
            for (let i = 0; i < dataBuffer.length; i += this.MAX_ENCRYPT_BLOCK) {
                const chunk = dataBuffer.slice(i, i + this.MAX_ENCRYPT_BLOCK);
                
                // 
                const encryptedChunk = crypto.privateEncrypt({
                    key: privateKeyPem,
                    padding: crypto.constants.RSA_PKCS1_PADDING
                }, chunk);
                
                // 
                encryptedChunks.push(encryptedChunk);
            }

            // 
            const encryptedBuffer = Buffer.concat(encryptedChunks);
            
            // 
            const encryptedBase64 = encryptedBuffer.toString('base64');
            
            return encryptedBase64;
            
        } catch (error) {
            console.error('failed:', error);
            throw error;
        }
    }

    /**
     * 
     */
    static paramFormat(param) {
        const sortedKeys = Object.keys(param).sort();
        const pairs = [];

        for (const key of sortedKeys) {
            const value = param[key];
            if (value !== null && value !== undefined && value.toString().trim() !== '') {
                pairs.push(`${key}=${value}`);
            }
        }

        return pairs.join('&');
    }


    static sign(privateKeyPem, source) {
        return this.encrypt(source, privateKeyPem);
    }


    static async createOrder(orderInfo, privateKey) {
        // 1
        const source = this.paramFormat(orderInfo);
        console.log('sign:', source);

        // 2. 
        const encryptedSign = this.sign(privateKey, source);
        console.log('length:', encryptedSign.length);

        // 3. 
        const requestData = {
            ...orderInfo,
            sign: encryptedSign
        };

        // 4. 
        const url = 'xxxx';
        const response = await this.doPost(url, JSON.stringify(requestData));
        
        return response;
    }

    /**
     * 
     */
    static doPost(url, json) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || 443,
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(json)
                }
            };

            const req = https.request(options, res => {
                let data = '';
                res.on('data', chunk => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(data);
                    } else {
                        reject(new Error(`Request failed: ${res.statusCode}`));
                    }
                });
            });

            req.on('error', error => {
                reject(error);
            });

            req.write(json);
            req.end();
        });
    }
}

export { TopPaySignUtil };
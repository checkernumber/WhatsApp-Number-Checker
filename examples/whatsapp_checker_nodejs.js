const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

class WhatsAppChecker {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.checknumber.ai/wa/api/simple/tasks';
        
        // Create axios instance with default headers
        this.client = axios.create({
            headers: {
                'X-API-Key': this.apiKey
            },
            timeout: 30000
        });
    }

    // Upload file for checking
    async uploadFile(filePath) {
        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // Create form data
            const form = new FormData();
            const fileStream = fs.createReadStream(filePath);
            form.append('file', fileStream, {
                filename: path.basename(filePath),
                contentType: 'text/plain'
            });

            // Make request
            const response = await this.client.post(this.baseUrl, form, {
                headers: {
                    ...form.getHeaders()
                }
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`HTTP error! status: ${error.response.status}, message: ${error.response.data}`);
            }
            throw error;
        }
    }

    // Check task status
    async checkTaskStatus(taskId, userId) {
        try {
            const url = `${this.baseUrl}/${taskId}?user_id=${userId}`;
            const response = await this.client.get(url);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`HTTP error! status: ${error.response.status}, message: ${error.response.data}`);
            }
            throw error;
        }
    }

    // Poll task status until completion
    async pollTaskStatus(taskId, userId, interval = 5000) {
        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    const response = await this.checkTaskStatus(taskId, userId);
                    console.log(`Status: ${response.status}, Success: ${response.success}, Total: ${response.total}`);

                    if (response.status === 'exported') {
                        console.log(`Results available at: ${response.result_url}`);
                        resolve(response);
                    } else if (response.status === 'failed') {
                        reject(new Error('Task failed'));
                    } else {
                        setTimeout(poll, interval);
                    }
                } catch (error) {
                    reject(error);
                }
            };
            poll();
        });
    }

    // Create file from array of phone numbers
    createInputFile(phoneNumbers, filePath = 'input.txt') {
        const content = Array.isArray(phoneNumbers) ? phoneNumbers.join('\n') : phoneNumbers;
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
    }

    // Download results file
    async downloadResults(resultUrl, outputPath = 'results.xlsx') {
        try {
            const response = await axios.get(resultUrl, {
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(outputPath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(outputPath));
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Failed to download results: ${error.message}`);
        }
    }
}

// Usage Example
async function main() {
    const apiKey = process.env.WHATSAPP_API_KEY || 'YOUR_API_KEY';
    const checker = new WhatsAppChecker(apiKey);

    try {
        // Example phone numbers
        const phoneNumbers = [
            '+1234567890',
            '+9876543210',
            '+1122334455'
        ];

        // Create input file
        const inputFile = checker.createInputFile(phoneNumbers, 'input.txt');
        console.log(`Created input file: ${inputFile}`);

        // Upload file
        console.log('Uploading file...');
        const uploadResponse = await checker.uploadFile(inputFile);
        console.log('Task ID:', uploadResponse.task_id);
        console.log('Initial Status:', uploadResponse.status);

        // Poll for completion
        console.log('Polling for task completion...');
        const finalResponse = await checker.pollTaskStatus(uploadResponse.task_id, uploadResponse.user_id);
        
        console.log('Task completed successfully!');
        
        // Download results if available
        if (finalResponse.result_url) {
            console.log('Downloading results...');
            const resultsFile = await checker.downloadResults(finalResponse.result_url, 'whatsapp_results.xlsx');
            console.log(`Results saved to: ${resultsFile}`);
        }

        // Clean up input file
        fs.unlinkSync(inputFile);
        console.log('Cleaned up temporary files');

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { WhatsAppChecker };

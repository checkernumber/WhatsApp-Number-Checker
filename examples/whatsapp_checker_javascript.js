// Browser-compatible JavaScript for WhatsApp account checking

class WhatsAppChecker {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.checknumber.ai/wa/api/simple/tasks';
    }

    // Upload file for checking
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'X-API-Key': this.apiKey
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    // Check task status
    async checkTaskStatus(taskId, userId) {
        const url = `${this.baseUrl}/${taskId}?user_id=${userId}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error checking task status:', error);
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
}

// Usage Example
async function main() {
    const apiKey = 'YOUR_API_KEY';
    const checker = new WhatsAppChecker(apiKey);

    try {
        // For file input from HTML form
        const fileInput = document.getElementById('file-input'); // Assuming you have a file input
        const file = fileInput.files[0];
        
        if (!file) {
            console.error('Please select a file');
            return;
        }

        // Upload file
        console.log('Uploading file...');
        const uploadResponse = await checker.uploadFile(file);
        console.log('Task ID:', uploadResponse.task_id);
        console.log('Initial Status:', uploadResponse.status);

        // Poll for completion
        console.log('Polling for task completion...');
        const finalResponse = await checker.pollTaskStatus(uploadResponse.task_id, uploadResponse.user_id);
        
        console.log('Task completed successfully!');
        console.log('Final response:', finalResponse);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Alternative: Create file from text content
function createFileFromText(content, filename = 'input.txt') {
    const blob = new Blob([content], { type: 'text/plain' });
    return new File([blob], filename, { type: 'text/plain' });
}

// Example usage with text content
async function checkNumbersFromText() {
    const apiKey = 'YOUR_API_KEY';
    const checker = new WhatsAppChecker(apiKey);

    // Example phone numbers
    const phoneNumbers = `+1234567890
+9876543210
+1122334455`;

    try {
        const file = createFileFromText(phoneNumbers);
        
        const uploadResponse = await checker.uploadFile(file);
        console.log('Upload response:', uploadResponse);
        
        const finalResponse = await checker.pollTaskStatus(uploadResponse.task_id, uploadResponse.user_id);
        console.log('Final response:', finalResponse);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// HTML Example
function createUI() {
    const htmlTemplate = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
        <h2>WhatsApp Number Checker</h2>
        
        <div style="margin-bottom: 20px;">
            <label for="api-key">API Key:</label><br>
            <input type="text" id="api-key" placeholder="YOUR_API_KEY" style="width: 300px; padding: 5px;">
        </div>
        
        <div style="margin-bottom: 20px;">
            <label for="file-input">Phone Numbers File:</label><br>
            <input type="file" id="file-input" accept=".txt">
        </div>
        
        <div style="margin-bottom: 20px;">
            <label for="text-input">Or Enter Phone Numbers (one per line):</label><br>
            <textarea id="text-input" rows="10" cols="40" placeholder="+1234567890\n+9876543210\n+1122334455"></textarea>
        </div>
        
        <button onclick="processFile()">Check WhatsApp Accounts</button>
        <button onclick="processText()">Check From Text</button>
        
        <div id="status" style="margin-top: 20px; padding: 10px; background-color: #f0f0f0;">
            Ready to check WhatsApp accounts...
        </div>
        
        <div id="results-info" style="margin-top: 10px; font-size: 12px; color: #666;">
            <p><strong>WhatsApp Status Values:</strong></p>
            <ul>
                <li><strong>yes</strong> - WhatsApp account found</li>
                <li><strong>no</strong> - No WhatsApp account associated with this number</li>
            </ul>
        </div>
    </div>
    `;
    
    document.body.innerHTML = htmlTemplate;
}

// Process file input
async function processFile() {
    const apiKey = document.getElementById('api-key').value;
    const fileInput = document.getElementById('file-input');
    const statusDiv = document.getElementById('status');
    
    if (!apiKey) {
        statusDiv.innerHTML = '<span style="color: red;">Please enter your API key</span>';
        return;
    }
    
    if (!fileInput.files[0]) {
        statusDiv.innerHTML = '<span style="color: red;">Please select a file</span>';
        return;
    }
    
    const checker = new WhatsAppChecker(apiKey);
    
    try {
        statusDiv.innerHTML = 'Uploading file...';
        const uploadResponse = await checker.uploadFile(fileInput.files[0]);
        
        statusDiv.innerHTML = `Task created! Task ID: ${uploadResponse.task_id}<br>Status: ${uploadResponse.status}`;
        
        const finalResponse = await checker.pollTaskStatus(uploadResponse.task_id, uploadResponse.user_id);
        
        statusDiv.innerHTML = `
            <span style="color: green;">Task completed successfully!</span><br>
            Total: ${finalResponse.total}<br>
            Success: ${finalResponse.success}<br>
            ${finalResponse.result_url ? `<a href="${finalResponse.result_url}" target="_blank">Download Results</a>` : ''}
        `;
        
    } catch (error) {
        statusDiv.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
    }
}

// Process text input
async function processText() {
    const apiKey = document.getElementById('api-key').value;
    const textInput = document.getElementById('text-input').value;
    const statusDiv = document.getElementById('status');
    
    if (!apiKey) {
        statusDiv.innerHTML = '<span style="color: red;">Please enter your API key</span>';
        return;
    }
    
    if (!textInput.trim()) {
        statusDiv.innerHTML = '<span style="color: red;">Please enter phone numbers</span>';
        return;
    }
    
    const checker = new WhatsAppChecker(apiKey);
    
    try {
        statusDiv.innerHTML = 'Creating file and uploading...';
        const file = createFileFromText(textInput);
        const uploadResponse = await checker.uploadFile(file);
        
        statusDiv.innerHTML = `Task created! Task ID: ${uploadResponse.task_id}<br>Status: ${uploadResponse.status}`;
        
        const finalResponse = await checker.pollTaskStatus(uploadResponse.task_id, uploadResponse.user_id);
        
        statusDiv.innerHTML = `
            <span style="color: green;">Task completed successfully!</span><br>
            Total: ${finalResponse.total}<br>
            Success: ${finalResponse.success}<br>
            ${finalResponse.result_url ? `<a href="${finalResponse.result_url}" target="_blank">Download Results</a>` : ''}
        `;
        
    } catch (error) {
        statusDiv.innerHTML = `<span style="color: red;">Error: ${error.message}</span>`;
    }
}

// Initialize UI when DOM is loaded
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', createUI);
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WhatsAppChecker, createFileFromText };
}

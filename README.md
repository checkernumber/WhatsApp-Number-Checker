# WhatsApp Number Checker API

[![API Status](https://img.shields.io/badge/API-Live-success)](https://api.checknumber.ai/wa/api/simple/tasks)
[![Language Support](https://img.shields.io/badge/Languages-9-blue)](#code-examples)
[![License](https://img.shields.io/badge/License-MIT-green)](#legal-compliance)

A comprehensive API service to verify WhatsApp account existence by phone numbers with bulk processing capabilities.

## Table of Contents
- [Features](#features)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
  - [File Upload](#file-upload)
  - [Task Status Check](#task-status-check)
- [Response Format](#response-format)
- [Code Examples](#code-examples)
- [Requirements](#requirements)
- [Workflow](#workflow)
- [Pricing](#pricing)
- [Support](#support)
- [Legal Compliance](#legal-compliance)

## Features
✅ Bulk phone number verification  
✅ Asynchronous processing for large datasets  
✅ Global phone number support  
✅ Excel/CSV result export  
✅ Real-time progress tracking  
✅ Enterprise-grade reliability  
✅ Multiple programming language examples  
✅ RESTful API architecture  
✅ Secure file handling  

## Getting Started

### Get API Key
1. Contact API provider to obtain your API key
2. Add the API key to your requests via `X-API-Key` header

### Base URL
```
https://api.checknumber.ai/wa/api/simple/tasks
```

## API Endpoints

### File Upload
Upload a text file containing phone numbers for batch verification.

**Endpoint**
```
POST https://api.checknumber.ai/wa/api/simple/tasks
```

**Headers**
```
X-API-Key: YOUR_API_KEY
Content-Type: multipart/form-data
```

**Request**
- Upload a text file with one phone number per line
- Supported formats: E.164 format recommended (+1234567890)

**cURL Example**
```bash
curl --location 'https://api.checknumber.ai/wa/api/simple/tasks' \
     --header 'X-API-Key: YOUR_API_KEY' \
     --form 'file=@"input.txt"'
```

**Input File Example (`input.txt`)**
```
+1234567890
+9876543210
+1122334455
+5556667777
+9998887777
```

### Task Status Check
Check the processing status of your uploaded task.

**Endpoint**
```
GET https://api.checknumber.ai/wa/api/simple/tasks/{task_id}?user_id={user_id}
```

**Headers**
```
X-API-Key: YOUR_API_KEY
```

**cURL Example**
```bash
curl --location 'https://api.checknumber.ai/wa/api/simple/tasks/cs9viu7i61pkfs4oavvg?user_id=USER_ID' \
     --header 'X-API-Key: YOUR_API_KEY'
```

## Response Format

### Upload Success Response
```json
{
  "created_at": "2024-10-19T18:24:56.450567423Z",
  "updated_at": "2024-10-19T18:24:56.450567423Z",
  "task_id": "cs9viu7i61pkfs4oavvg",
  "user_id": "test",
  "status": "pending",
  "total": 0,
  "success": 0,
  "failure": 0
}
```

### Processing Status Response
```json
{
  "created_at": "2024-10-19T18:24:56.450567423Z",
  "updated_at": "2024-10-19T18:33:22.86152082Z",
  "task_id": "cs9viu7i61pkfs4oavvg",
  "user_id": "test",
  "status": "processing",
  "total": 20000,
  "success": 6724,
  "failure": 0
}
```

### Completion Response
```json
{
  "created_at": "2024-10-19T18:24:56.450567423Z",
  "updated_at": "2024-10-19T18:53:43.141760071Z",
  "task_id": "cs9viu7i61pkfs4oavvg",
  "user_id": "test",
  "status": "exported",
  "total": 20000,
  "success": 20000,
  "failure": 0,
  "result_url": "https://example-link-to-results.xlsx"
}
```

### Status Values
- `pending` - Task created, waiting to start
- `processing` - Currently processing numbers
- `completed` - Processing finished
- `exported` - Complete with downloadable results

### Result Fields
The exported results contain the following fields:

| Field | Description | Example |
|-------|-------------|---------|
| Number | Phone number in E.164 format | +41798284651 |
| whatsapp | Whether number has active WhatsApp account | yes, no |

## Code Examples

We provide complete, production-ready examples in 9+ programming languages:

### Python Example
```python
import requests
import time

class WhatsAppChecker:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = 'https://api.checknumber.ai/wa/api/simple/tasks'
        self.headers = {'X-API-Key': self.api_key}
    
    def upload_file(self, file_path):
        with open(file_path, 'rb') as file:
            files = {'file': file}
            response = requests.post(self.base_url, files=files, headers=self.headers)
            return response.json()
    
    def check_status(self, task_id, user_id):
        url = f"{self.base_url}/{task_id}?user_id={user_id}"
        response = requests.get(url, headers=self.headers)
        return response.json()

# Usage
checker = WhatsAppChecker('YOUR_API_KEY')
result = checker.upload_file('input.txt')
print(f"Task ID: {result['task_id']}")
```

### Node.js Example
```javascript
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');

class WhatsAppChecker {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.checknumber.ai/wa/api/simple/tasks';
    }
    
    async uploadFile(filePath) {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        
        const response = await axios.post(this.baseUrl, form, {
            headers: {
                'X-API-Key': this.apiKey,
                ...form.getHeaders()
            }
        });
        
        return response.data;
    }
}

// Usage
const checker = new WhatsAppChecker('YOUR_API_KEY');
checker.uploadFile('input.txt').then(result => {
    console.log(`Task ID: ${result.task_id}`);
});
```

### Available Languages
- **C#** - Full async/await implementation
- **Go** - Concurrent processing ready
- **Java** - Modern HTTP client usage
- **JavaScript** - Browser compatible
- **Node.js** - Server-side JavaScript
- **PHP** - cURL-based implementation
- **Python** - Requests library with typing
- **Shell** - Bash script with error handling

📁 **[View all examples →](examples/)**

### Complete File List
- `whatsapp_checker_python.py` - Python implementation
- `whatsapp_checker_nodejs.js` - Node.js implementation  
- `whatsapp_checker_go.go` - Go implementation
- `whatsapp_checker_java.java` - Java implementation
- `whatsapp_checker_csharp.cs` - C# implementation
- `whatsapp_checker_javascript.js` - Browser JavaScript
- `whatsapp_checker_php.php` - PHP implementation
- `whatsapp_checker_shell.sh` - Shell script

## Requirements

### Input File Requirements
- **Format**: Plain text file (.txt)
- **Content**: One phone number per line
- **Phone Format**: E.164 format recommended (`+1234567890`)
- **File Size**: No explicit limit mentioned
- **Encoding**: UTF-8

### API Limits
- **Authentication**: API key required
- **Rate Limits**: Contact provider for details
- **File Upload**: Text files only
- **Processing Time**: Varies by dataset size

### Supported Phone Formats
- E.164 format: `+1234567890`
- International format: `+12345678901`
- National formats may work but E.164 recommended

## Workflow

1. **📤 Upload** - Submit text file with phone numbers
2. **⏳ Queue** - Task enters processing queue
3. **🔄 Process** - Numbers checked against WhatsApp database
4. **📊 Monitor** - Poll status endpoint for progress
5. **📥 Download** - Retrieve Excel/CSV results when complete

**Typical Processing Time**: 1-10 minutes depending on dataset size

## Status Codes

| Status | Description |
|--------|-------------|
| 200 | Request successful, task created or status retrieved |
| 400 | Bad request, invalid parameters or file format |
| 500 | Internal server error, retry later |

## Pricing

Contact the API provider for current pricing information.

- Free tier may be available for testing
- Flexible plans for different usage volumes
- Enterprise pricing for high-volume usage

## Support

For technical support, enterprise inquiries, or API access:

📧 **Contact**: API Provider Support  
🔗 **Documentation**: This repository  
💬 **Issues**: Create GitHub issue for bugs  
🚀 **Enterprise**: Contact for custom solutions  

### Common Issues
- **API Key Invalid**: Verify your API key is correct
- **File Upload Failed**: Check file format and size
- **Task Stuck**: Contact support with task ID
- **Results Not Ready**: Allow more time for large datasets

## Legal Compliance

This API is intended for **legitimate use cases only**. Users are responsible for:

✅ **Compliance**: Following WhatsApp's Terms of Service  
✅ **Privacy**: Adhering to data privacy laws (GDPR, CCPA, etc.)  
✅ **Consent**: Obtaining proper consent for data processing  
✅ **Purpose**: Using data for legitimate business purposes only  

### Disclaimer
- This service is **not affiliated** with or endorsed by Meta/WhatsApp
- Users must comply with all applicable laws and regulations
- Service is provided "as is" without warranties
- Rate limiting and fair use policies apply

### Ethical Use
- ✅ Account verification for customer service
- ✅ Fraud prevention and security
- ✅ Marketing compliance verification
- ❌ Harassment or stalking
- ❌ Unauthorized contact collection
- ❌ Privacy violations

---

**Last Updated**: October 2024  
**Version**: 1.0.0  
**API Status**: ✅ Active

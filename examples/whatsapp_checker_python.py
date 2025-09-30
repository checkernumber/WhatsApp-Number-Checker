#!/usr/bin/env python3

import requests
import time
import os
import json
from typing import Dict, List, Union, Optional

class WhatsAppChecker:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = 'https://api.checknumber.ai/wa/api/simple/tasks'
        self.session = requests.Session()
        self.session.headers.update({'X-API-Key': self.api_key})
        self.session.timeout = 30
    
    def upload_file(self, file_path: str) -> Dict:
        """Upload file for checking"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        try:
            with open(file_path, 'rb') as file:
                files = {'file': (os.path.basename(file_path), file, 'text/plain')}
                response = self.session.post(self.base_url, files=files)
            
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {e}")
        except json.JSONDecodeError as e:
            raise Exception(f"JSON decode error: {e}")
    
    def check_task_status(self, task_id: str, user_id: str) -> Dict:
        """Check task status"""
        url = f"{self.base_url}/{task_id}?user_id={user_id}"
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {e}")
        except json.JSONDecodeError as e:
            raise Exception(f"JSON decode error: {e}")
    
    def poll_task_status(self, task_id: str, user_id: str, interval: int = 5) -> Dict:
        """Poll task status until completion"""
        while True:
            response = self.check_task_status(task_id, user_id)
            print(f"Status: {response['status']}, Success: {response['success']}, Total: {response['total']}")
            
            if response['status'] == 'exported':
                print(f"Results available at: {response.get('result_url', 'N/A')}")
                return response
            elif response['status'] == 'failed':
                raise Exception('Task failed')
            
            time.sleep(interval)
    
    def create_input_file(self, phone_numbers: Union[List[str], str], file_path: str = 'input.txt') -> str:
        """Create input file from phone numbers"""
        if isinstance(phone_numbers, list):
            content = '\n'.join(phone_numbers)
        else:
            content = phone_numbers
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return file_path
        except IOError as e:
            raise Exception(f"Failed to create file {file_path}: {e}")
    
    def download_results(self, result_url: str, output_path: str = 'results.xlsx') -> str:
        """Download results file"""
        try:
            response = requests.get(result_url, stream=True, timeout=300)
            response.raise_for_status()
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            
            return output_path
        
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to download results: {e}")
    
    def close(self):
        """Close the session"""
        self.session.close()

def main():
    """Main function demonstrating usage"""
    api_key = os.environ.get('WHATSAPP_API_KEY', 'YOUR_API_KEY')
    checker = WhatsAppChecker(api_key)
    
    try:
        # Example phone numbers
        phone_numbers = [
            '+1234567890',
            '+9876543210',
            '+1122334455'
        ]
        
        # Create input file
        input_file = checker.create_input_file(phone_numbers, 'input.txt')
        print(f"Created input file: {input_file}")
        
        # Upload file
        print("Uploading file...")
        upload_response = checker.upload_file(input_file)
        print(f"Task ID: {upload_response['task_id']}")
        print(f"Initial Status: {upload_response['status']}")
        
        # Poll for completion
        print("Polling for task completion...")
        final_response = checker.poll_task_status(upload_response['task_id'], upload_response['user_id'])
        
        print("Task completed successfully!")
        
        # Download results if available
        if final_response.get('result_url'):
            print("Downloading results...")
            results_file = checker.download_results(final_response['result_url'], 'whatsapp_results.xlsx')
            print(f"Results saved to: {results_file}")
        
        # Clean up input file
        if os.path.exists(input_file):
            os.remove(input_file)
            print("Cleaned up temporary files")
    
    except Exception as e:
        print(f"Error: {e}")
        exit(1)
    
    finally:
        checker.close()

if __name__ == '__main__':
    main()

<?php

class WhatsAppChecker
{
    private string $apiKey;
    private string $baseUrl;
    private array $curlOptions;

    public function __construct(string $apiKey)
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = 'https://api.checknumber.ai/wa/api/simple/tasks';
        $this->curlOptions = [
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER => [
                'X-API-Key: ' . $this->apiKey
            ]
        ];
    }

    public function uploadFile(string $filePath): array
    {
        if (!file_exists($filePath)) {
            throw new InvalidArgumentException("File not found: $filePath");
        }

        $curl = curl_init();
        
        $postFields = [
            'file' => new CURLFile($filePath, 'text/plain', basename($filePath))
        ];

        $options = $this->curlOptions + [
            CURLOPT_URL => $this->baseUrl,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $postFields
        ];

        curl_setopt_array($curl, $options);

        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);

        curl_close($curl);

        if ($error) {
            throw new RuntimeException("cURL error: $error");
        }

        if ($httpCode !== 200) {
            throw new RuntimeException("HTTP error: $httpCode");
        }

        $decoded = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException("JSON decode error: " . json_last_error_msg());
        }

        return $decoded;
    }

    public function checkTaskStatus(string $taskId, string $userId): array
    {
        $url = $this->baseUrl . "/$taskId?user_id=$userId";
        
        $curl = curl_init();

        $options = $this->curlOptions + [
            CURLOPT_URL => $url,
            CURLOPT_HTTPGET => true
        ];

        curl_setopt_array($curl, $options);

        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);

        curl_close($curl);

        if ($error) {
            throw new RuntimeException("cURL error: $error");
        }

        if ($httpCode !== 200) {
            throw new RuntimeException("HTTP error: $httpCode");
        }

        $decoded = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException("JSON decode error: " . json_last_error_msg());
        }

        return $decoded;
    }

    public function pollTaskStatus(string $taskId, string $userId, int $intervalSeconds = 5): array
    {
        while (true) {
            $response = $this->checkTaskStatus($taskId, $userId);
            
            echo "Status: {$response['status']}, Success: {$response['success']}, Total: {$response['total']}\n";

            switch ($response['status']) {
                case 'exported':
                    $resultUrl = $response['result_url'] ?? 'N/A';
                    echo "Results available at: $resultUrl\n";
                    return $response;
                case 'failed':
                    throw new RuntimeException('Task failed');
                default:
                    sleep($intervalSeconds);
                    break;
            }
        }
    }

    public function createInputFile(array $phoneNumbers, string $filePath = 'input.txt'): string
    {
        $content = implode("\n", $phoneNumbers);
        return $this->createInputFileFromString($content, $filePath);
    }

    public function createInputFileFromString(string $content, string $filePath = 'input.txt'): string
    {
        if (file_put_contents($filePath, $content) === false) {
            throw new RuntimeException("Failed to create file: $filePath");
        }
        return $filePath;
    }

    public function downloadResults(string $resultUrl, string $outputPath = 'results.xlsx'): string
    {
        $curl = curl_init();

        $options = [
            CURLOPT_URL => $resultUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_TIMEOUT => 300
        ];

        curl_setopt_array($curl, $options);

        $response = curl_exec($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $error = curl_error($curl);

        curl_close($curl);

        if ($error) {
            throw new RuntimeException("cURL error: $error");
        }

        if ($httpCode !== 200) {
            throw new RuntimeException("HTTP error: $httpCode");
        }

        if (file_put_contents($outputPath, $response) === false) {
            throw new RuntimeException("Failed to save results to: $outputPath");
        }

        return $outputPath;
    }
}

// Usage example
function main(): void
{
    $apiKey = $_ENV['WHATSAPP_API_KEY'] ?? 'YOUR_API_KEY';
    $checker = new WhatsAppChecker($apiKey);

    try {
        // Example phone numbers
        $phoneNumbers = [
            '+1234567890',
            '+9876543210',
            '+1122334455'
        ];

        // Create input file
        $inputFile = $checker->createInputFile($phoneNumbers, 'input.txt');
        echo "Created input file: $inputFile\n";

        // Upload file
        echo "Uploading file...\n";
        $uploadResponse = $checker->uploadFile($inputFile);
        echo "Task ID: {$uploadResponse['task_id']}\n";
        echo "Initial Status: {$uploadResponse['status']}\n";

        // Poll for completion
        echo "Polling for task completion...\n";
        $finalResponse = $checker->pollTaskStatus($uploadResponse['task_id'], $uploadResponse['user_id']);

        echo "Task completed successfully!\n";

        // Download results if available
        if (!empty($finalResponse['result_url'])) {
            echo "Downloading results...\n";
            $resultsFile = $checker->downloadResults($finalResponse['result_url'], 'whatsapp_results.xlsx');
            echo "Results saved to: $resultsFile\n";
        }

        // Clean up input file
        if (unlink($inputFile)) {
            echo "Cleaned up temporary files\n";
        }

    } catch (Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
        exit(1);
    }
}

// Run if called directly
if (basename(__FILE__) === basename($_SERVER['SCRIPT_NAME'])) {
    main();
}

?>

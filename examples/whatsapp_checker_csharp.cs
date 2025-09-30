using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using System.Text.Json;
using System.Collections.Generic;

public class WhatsAppChecker
{
    private readonly string apiKey;
    private readonly string baseUrl;
    private readonly HttpClient httpClient;

    public WhatsAppChecker(string apiKey)
    {
        this.apiKey = apiKey;
        this.baseUrl = "https://api.checknumber.ai/wa/api/simple/tasks";
        this.httpClient = new HttpClient();
        this.httpClient.DefaultRequestHeaders.Add("X-API-Key", apiKey);
        this.httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    public async Task<WhatsAppResponse> UploadFileAsync(string filePath)
    {
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException($"File not found: {filePath}");
        }

        using var form = new MultipartFormDataContent();
        using var fileStream = new FileStream(filePath, FileMode.Open, FileAccess.Read);
        using var streamContent = new StreamContent(fileStream);
        
        streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/plain");
        form.Add(streamContent, "file", Path.GetFileName(filePath));

        try
        {
            var response = await httpClient.PostAsync(baseUrl, form);
            response.EnsureSuccessStatusCode();
            
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<WhatsAppResponse>(json);
        }
        catch (HttpRequestException ex)
        {
            throw new Exception($"Request failed: {ex.Message}");
        }
        catch (JsonException ex)
        {
            throw new Exception($"JSON parsing error: {ex.Message}");
        }
    }

    public async Task<WhatsAppResponse> CheckTaskStatusAsync(string taskId, string userId)
    {
        var url = $"{baseUrl}/{taskId}?user_id={userId}";
        
        try
        {
            var response = await httpClient.GetAsync(url);
            response.EnsureSuccessStatusCode();
            
            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<WhatsAppResponse>(json);
        }
        catch (HttpRequestException ex)
        {
            throw new Exception($"Request failed: {ex.Message}");
        }
        catch (JsonException ex)
        {
            throw new Exception($"JSON parsing error: {ex.Message}");
        }
    }

    public async Task<WhatsAppResponse> PollTaskStatusAsync(string taskId, string userId, int intervalSeconds = 5)
    {
        while (true)
        {
            var response = await CheckTaskStatusAsync(taskId, userId);
            Console.WriteLine($"Status: {response.Status}, Success: {response.Success}, Total: {response.Total}");

            switch (response.Status)
            {
                case "exported":
                    Console.WriteLine($"Results available at: {response.ResultUrl ?? "N/A"}");
                    return response;
                case "failed":
                    throw new Exception("Task failed");
                default:
                    await Task.Delay(intervalSeconds * 1000);
                    break;
            }
        }
    }

    public string CreateInputFile(string[] phoneNumbers, string filePath = "input.txt")
    {
        try
        {
            File.WriteAllText(filePath, string.Join("\n", phoneNumbers));
            return filePath;
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to create file {filePath}: {ex.Message}");
        }
    }

    public string CreateInputFile(string phoneNumbers, string filePath = "input.txt")
    {
        try
        {
            File.WriteAllText(filePath, phoneNumbers);
            return filePath;
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to create file {filePath}: {ex.Message}");
        }
    }

    public async Task<string> DownloadResultsAsync(string resultUrl, string outputPath = "results.xlsx")
    {
        try
        {
            var response = await httpClient.GetAsync(resultUrl);
            response.EnsureSuccessStatusCode();

            await using var fileStream = new FileStream(outputPath, FileMode.Create);
            await response.Content.CopyToAsync(fileStream);

            return outputPath;
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to download results: {ex.Message}");
        }
    }

    public void Dispose()
    {
        httpClient?.Dispose();
    }
}

public class WhatsAppResponse
{
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string TaskId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Success { get; set; }
    public int Failure { get; set; }
    public string? ResultUrl { get; set; }
}

class Program
{
    static async Task Main(string[] args)
    {
        var apiKey = Environment.GetEnvironmentVariable("WHATSAPP_API_KEY") ?? "YOUR_API_KEY";
        var checker = new WhatsAppChecker(apiKey);

        try
        {
            // Example phone numbers
            var phoneNumbers = new[]
            {
                "+1234567890",
                "+9876543210",
                "+1122334455"
            };

            // Create input file
            var inputFile = checker.CreateInputFile(phoneNumbers, "input.txt");
            Console.WriteLine($"Created input file: {inputFile}");

            // Upload file
            Console.WriteLine("Uploading file...");
            var uploadResponse = await checker.UploadFileAsync(inputFile);
            Console.WriteLine($"Task ID: {uploadResponse.TaskId}");
            Console.WriteLine($"Initial Status: {uploadResponse.Status}");

            // Poll for completion
            Console.WriteLine("Polling for task completion...");
            var finalResponse = await checker.PollTaskStatusAsync(uploadResponse.TaskId, uploadResponse.UserId);

            Console.WriteLine("Task completed successfully!");

            // Download results if available
            if (!string.IsNullOrEmpty(finalResponse.ResultUrl))
            {
                Console.WriteLine("Downloading results...");
                var resultsFile = await checker.DownloadResultsAsync(finalResponse.ResultUrl, "whatsapp_results.xlsx");
                Console.WriteLine($"Results saved to: {resultsFile}");
            }

            // Clean up input file
            if (File.Exists(inputFile))
            {
                File.Delete(inputFile);
                Console.WriteLine("Cleaned up temporary files");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            Environment.Exit(1);
        }
        finally
        {
            checker.Dispose();
        }
    }
}

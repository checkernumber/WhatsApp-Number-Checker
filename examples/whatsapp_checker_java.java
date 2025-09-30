import java.io.*;
import java.net.http.*;
import java.net.URI;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

public class WhatsAppChecker {
    private final String apiKey;
    private final String baseUrl;
    private final HttpClient httpClient;
    private final Gson gson;

    public WhatsAppChecker(String apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://api.checknumber.ai/wa/api/simple/tasks";
        this.httpClient = HttpClient.newBuilder()
            .timeout(Duration.ofSeconds(30))
            .build();
        this.gson = new Gson();
    }

    public CompletableFuture<WhatsAppResponse> uploadFile(String filePath) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                throw new FileNotFoundException("File not found: " + filePath);
            }

            String boundary = "----WebKitFormBoundary" + System.currentTimeMillis();
            String multipartBody = createMultipartBody(file, boundary);

            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl))
                .header("X-API-Key", apiKey)
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofString(multipartBody))
                .build();

            return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(response -> {
                    if (response.statusCode() != 200) {
                        throw new RuntimeException("HTTP error: " + response.statusCode());
                    }
                    return gson.fromJson(response.body(), WhatsAppResponse.class);
                });

        } catch (Exception e) {
            return CompletableFuture.failedFuture(e);
        }
    }

    private String createMultipartBody(File file, String boundary) throws IOException {
        StringBuilder builder = new StringBuilder();
        builder.append("--").append(boundary).append("\r\n");
        builder.append("Content-Disposition: form-data; name=\"file\"; filename=\"")
               .append(file.getName()).append("\"\r\n");
        builder.append("Content-Type: text/plain\r\n\r\n");
        
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line).append("\n");
            }
        }
        
        builder.append("\r\n--").append(boundary).append("--\r\n");
        return builder.toString();
    }

    public CompletableFuture<WhatsAppResponse> checkTaskStatus(String taskId, String userId) {
        String url = baseUrl + "/" + taskId + "?user_id=" + userId;

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .header("X-API-Key", apiKey)
            .GET()
            .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
            .thenApply(response -> {
                if (response.statusCode() != 200) {
                    throw new RuntimeException("HTTP error: " + response.statusCode());
                }
                return gson.fromJson(response.body(), WhatsAppResponse.class);
            });
    }

    public CompletableFuture<WhatsAppResponse> pollTaskStatus(String taskId, String userId, int intervalSeconds) {
        return CompletableFuture.supplyAsync(() -> {
            while (true) {
                try {
                    WhatsAppResponse response = checkTaskStatus(taskId, userId).get();
                    System.out.printf("Status: %s, Success: %d, Total: %d%n", 
                                    response.status, response.success, response.total);

                    switch (response.status) {
                        case "exported":
                            System.out.println("Results available at: " + 
                                             (response.resultUrl != null ? response.resultUrl : "N/A"));
                            return response;
                        case "failed":
                            throw new RuntimeException("Task failed");
                        default:
                            Thread.sleep(intervalSeconds * 1000);
                            break;
                    }
                } catch (Exception e) {
                    throw new RuntimeException("Polling failed", e);
                }
            }
        });
    }

    public void createInputFile(String[] phoneNumbers, String filePath) throws IOException {
        try (PrintWriter writer = new PrintWriter(new FileWriter(filePath))) {
            for (String number : phoneNumbers) {
                writer.println(number);
            }
        }
    }

    public void createInputFile(String content, String filePath) throws IOException {
        try (PrintWriter writer = new PrintWriter(new FileWriter(filePath))) {
            writer.print(content);
        }
    }

    public CompletableFuture<String> downloadResults(String resultUrl, String outputPath) {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(resultUrl))
            .GET()
            .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofInputStream())
            .thenApply(response -> {
                if (response.statusCode() != 200) {
                    throw new RuntimeException("HTTP error: " + response.statusCode());
                }
                
                try (InputStream inputStream = response.body();
                     FileOutputStream outputStream = new FileOutputStream(outputPath)) {
                    
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }
                    
                    return outputPath;
                } catch (IOException e) {
                    throw new RuntimeException("Failed to download results", e);
                }
            });
    }

    public static class WhatsAppResponse {
        @SerializedName("created_at")
        public String createdAt;
        
        @SerializedName("updated_at")
        public String updatedAt;
        
        @SerializedName("task_id")
        public String taskId;
        
        @SerializedName("user_id")
        public String userId;
        
        public String status;
        public int total;
        public int success;
        public int failure;
        
        @SerializedName("result_url")
        public String resultUrl;
    }

    public static void main(String[] args) {
        String apiKey = System.getenv("WHATSAPP_API_KEY");
        if (apiKey == null) {
            apiKey = "YOUR_API_KEY";
        }

        WhatsAppChecker checker = new WhatsAppChecker(apiKey);

        try {
            // Example phone numbers
            String[] phoneNumbers = {
                "+1234567890",
                "+9876543210",
                "+1122334455"
            };

            // Create input file
            String inputFile = "input.txt";
            checker.createInputFile(phoneNumbers, inputFile);
            System.out.println("Created input file: " + inputFile);

            // Upload file
            System.out.println("Uploading file...");
            WhatsAppResponse uploadResponse = checker.uploadFile(inputFile).get();
            System.out.println("Task ID: " + uploadResponse.taskId);
            System.out.println("Initial Status: " + uploadResponse.status);

            // Poll for completion
            System.out.println("Polling for task completion...");
            WhatsAppResponse finalResponse = checker.pollTaskStatus(
                uploadResponse.taskId, uploadResponse.userId, 5).get();

            System.out.println("Task completed successfully!");

            // Download results if available
            if (finalResponse.resultUrl != null && !finalResponse.resultUrl.isEmpty()) {
                System.out.println("Downloading results...");
                String resultsFile = checker.downloadResults(
                    finalResponse.resultUrl, "whatsapp_results.xlsx").get();
                System.out.println("Results saved to: " + resultsFile);
            }

            // Clean up input file
            File file = new File(inputFile);
            if (file.delete()) {
                System.out.println("Cleaned up temporary files");
            }

        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            System.exit(1);
        }
    }
}

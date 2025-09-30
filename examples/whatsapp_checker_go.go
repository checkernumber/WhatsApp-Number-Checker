package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type WhatsAppChecker struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

type WhatsAppResponse struct {
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	TaskID    string `json:"task_id"`
	UserID    string `json:"user_id"`
	Status    string `json:"status"`
	Total     int    `json:"total"`
	Success   int    `json:"success"`
	Failure   int    `json:"failure"`
	ResultURL string `json:"result_url,omitempty"`
}

func NewWhatsAppChecker(apiKey string) *WhatsAppChecker {
	return &WhatsAppChecker{
		apiKey:  apiKey,
		baseURL: "https://api.checknumber.ai/wa/api/simple/tasks",
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (wc *WhatsAppChecker) UploadFile(filePath string) (*WhatsAppResponse, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %v", err)
	}
	defer file.Close()

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %v", err)
	}

	_, err = io.Copy(part, file)
	if err != nil {
		return nil, fmt.Errorf("failed to copy file: %v", err)
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close writer: %v", err)
	}

	req, err := http.NewRequest("POST", wc.baseURL, &buf)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("X-API-Key", wc.apiKey)

	resp, err := wc.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	var result WhatsAppResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	return &result, nil
}

func (wc *WhatsAppChecker) CheckTaskStatus(taskID, userID string) (*WhatsAppResponse, error) {
	url := fmt.Sprintf("%s/%s?user_id=%s", wc.baseURL, taskID, userID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("X-API-Key", wc.apiKey)

	resp, err := wc.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	var result WhatsAppResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	return &result, nil
}

func (wc *WhatsAppChecker) PollTaskStatus(taskID, userID string, interval time.Duration) (*WhatsAppResponse, error) {
	for {
		resp, err := wc.CheckTaskStatus(taskID, userID)
		if err != nil {
			return nil, err
		}

		fmt.Printf("Status: %s, Success: %d, Total: %d\n", resp.Status, resp.Success, resp.Total)

		switch resp.Status {
		case "exported":
			fmt.Printf("Results available at: %s\n", resp.ResultURL)
			return resp, nil
		case "failed":
			return nil, fmt.Errorf("task failed")
		default:
			time.Sleep(interval)
		}
	}
}

func (wc *WhatsAppChecker) CreateInputFile(phoneNumbers []string, filePath string) error {
	content := strings.Join(phoneNumbers, "\n")
	return os.WriteFile(filePath, []byte(content), 0644)
}

func (wc *WhatsAppChecker) CreateInputFileFromString(content, filePath string) error {
	return os.WriteFile(filePath, []byte(content), 0644)
}

func (wc *WhatsAppChecker) DownloadResults(resultURL, outputPath string) error {
	resp, err := http.Get(resultURL)
	if err != nil {
		return fmt.Errorf("failed to download results: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create output file: %v", err)
	}
	defer file.Close()

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		return fmt.Errorf("failed to write to file: %v", err)
	}

	return nil
}

func main() {
	apiKey := os.Getenv("WHATSAPP_API_KEY")
	if apiKey == "" {
		apiKey = "YOUR_API_KEY"
	}

	checker := NewWhatsAppChecker(apiKey)

	// Example phone numbers
	phoneNumbers := []string{
		"+1234567890",
		"+9876543210",
		"+1122334455",
	}

	// Create input file
	inputFile := "input.txt"
	err := checker.CreateInputFile(phoneNumbers, inputFile)
	if err != nil {
		log.Fatalf("Failed to create input file: %v", err)
	}
	fmt.Printf("Created input file: %s\n", inputFile)

	// Upload file
	fmt.Println("Uploading file...")
	uploadResponse, err := checker.UploadFile(inputFile)
	if err != nil {
		log.Fatalf("Upload failed: %v", err)
	}
	fmt.Printf("Task ID: %s\n", uploadResponse.TaskID)
	fmt.Printf("Initial Status: %s\n", uploadResponse.Status)

	// Poll for completion
	fmt.Println("Polling for task completion...")
	finalResponse, err := checker.PollTaskStatus(uploadResponse.TaskID, uploadResponse.UserID, 5*time.Second)
	if err != nil {
		log.Fatalf("Polling failed: %v", err)
	}

	fmt.Println("Task completed successfully!")

	// Download results if available
	if finalResponse.ResultURL != "" {
		fmt.Println("Downloading results...")
		resultsFile := "whatsapp_results.xlsx"
		err := checker.DownloadResults(finalResponse.ResultURL, resultsFile)
		if err != nil {
			log.Printf("Failed to download results: %v", err)
		} else {
			fmt.Printf("Results saved to: %s\n", resultsFile)
		}
	}

	// Clean up input file
	if err := os.Remove(inputFile); err == nil {
		fmt.Println("Cleaned up temporary files")
	}
}

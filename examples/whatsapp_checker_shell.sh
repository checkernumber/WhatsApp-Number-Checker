#!/bin/bash

# WhatsApp Account Checker Shell Script
# Requires: curl, jq

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Configuration
API_KEY="${WHATSAPP_API_KEY:-YOUR_API_KEY}"
BASE_URL="https://api.checknumber.ai/wa/api/simple/tasks"
TIMEOUT=30
POLL_INTERVAL=5

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Check dependencies
check_dependencies() {
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        log_error "Please install them and try again."
        exit 1
    fi
}

# Validate API key
validate_api_key() {
    if [ "$API_KEY" = "YOUR_API_KEY" ] || [ -z "$API_KEY" ]; then
        log_error "Please set a valid API key in WHATSAPP_API_KEY environment variable"
        exit 1
    fi
}

# Upload file function
upload_file() {
    local file_path="$1"
    
    if [ ! -f "$file_path" ]; then
        log_error "File not found: $file_path"
        return 1
    fi
    
    log_info "Uploading file: $file_path"
    
    local response
    response=$(curl -s --max-time "$TIMEOUT" \
        --location "$BASE_URL" \
        --header "X-API-Key: $API_KEY" \
        --form "file=@\"$file_path\"" \
        --write-out "\nHTTP_STATUS:%{http_code}")
    
    local http_status
    http_status=$(echo "$response" | tail -n1 | cut -d: -f2)
    local json_response
    json_response=$(echo "$response" | sed '$d')
    
    if [ "$http_status" -ne 200 ]; then
        log_error "Upload failed with HTTP status: $http_status"
        echo "$json_response" | jq -r '.' 2>/dev/null || echo "$json_response"
        return 1
    fi
    
    echo "$json_response"
}

# Check task status function
check_task_status() {
    local task_id="$1"
    local user_id="$2"
    
    local url="${BASE_URL}/${task_id}?user_id=${user_id}"
    
    local response
    response=$(curl -s --max-time "$TIMEOUT" \
        --location "$url" \
        --header "X-API-Key: $API_KEY" \
        --write-out "\nHTTP_STATUS:%{http_code}")
    
    local http_status
    http_status=$(echo "$response" | tail -n1 | cut -d: -f2)
    local json_response
    json_response=$(echo "$response" | sed '$d')
    
    if [ "$http_status" -ne 200 ]; then
        log_error "Status check failed with HTTP status: $http_status"
        echo "$json_response" | jq -r '.' 2>/dev/null || echo "$json_response"
        return 1
    fi
    
    echo "$json_response"
}

# Poll task status until completion
poll_task_status() {
    local task_id="$1"
    local user_id="$2"
    
    log_info "Polling task status (Task ID: $task_id)"
    
    while true; do
        local response
        if ! response=$(check_task_status "$task_id" "$user_id"); then
            return 1
        fi
        
        local status
        status=$(echo "$response" | jq -r '.status')
        local success
        success=$(echo "$response" | jq -r '.success')
        local total
        total=$(echo "$response" | jq -r '.total')
        
        log_info "Status: $status, Success: $success, Total: $total"
        
        case "$status" in
            "exported")
                local result_url
                result_url=$(echo "$response" | jq -r '.result_url // "N/A"')
                log_success "Results available at: $result_url"
                echo "$response"
                return 0
                ;;
            "failed")
                log_error "Task failed"
                return 1
                ;;
            *)
                sleep "$POLL_INTERVAL"
                ;;
        esac
    done
}

# Create input file from phone numbers
create_input_file() {
    local phone_numbers=("$@")
    local output_file="${phone_numbers[-1]}"  # Last argument is output file
    unset phone_numbers[-1]  # Remove last element
    
    log_info "Creating input file: $output_file"
    
    printf '%s\n' "${phone_numbers[@]}" > "$output_file"
    
    if [ -f "$output_file" ]; then
        log_success "Created input file with ${#phone_numbers[@]} phone numbers"
        return 0
    else
        log_error "Failed to create input file"
        return 1
    fi
}

# Download results
download_results() {
    local result_url="$1"
    local output_path="${2:-results.xlsx}"
    
    if [ "$result_url" = "N/A" ] || [ -z "$result_url" ]; then
        log_warning "No result URL provided, skipping download"
        return 0
    fi
    
    log_info "Downloading results to: $output_path"
    
    if curl -s --max-time 300 \
        --location "$result_url" \
        --output "$output_path" \
        --write-out "HTTP_STATUS:%{http_code}" | grep -q "HTTP_STATUS:200"; then
        log_success "Results downloaded successfully"
        return 0
    else
        log_error "Failed to download results"
        return 1
    fi
}

# Main function
main() {
    local input_file="input.txt"
    local results_file="whatsapp_results.xlsx"
    
    log_info "WhatsApp Account Checker - Starting process"
    
    # Check dependencies and API key
    check_dependencies
    validate_api_key
    
    # Example phone numbers
    local phone_numbers=(
        "+1234567890"
        "+9876543210"
        "+1122334455"
    )
    
    # Create input file
    if ! create_input_file "${phone_numbers[@]}" "$input_file"; then
        exit 1
    fi
    
    # Upload file
    local upload_response
    if ! upload_response=$(upload_file "$input_file"); then
        exit 1
    fi
    
    local task_id
    task_id=$(echo "$upload_response" | jq -r '.task_id')
    local user_id
    user_id=$(echo "$upload_response" | jq -r '.user_id')
    local initial_status
    initial_status=$(echo "$upload_response" | jq -r '.status')
    
    log_success "File uploaded successfully"
    log_info "Task ID: $task_id"
    log_info "Initial Status: $initial_status"
    
    # Poll for completion
    local final_response
    if ! final_response=$(poll_task_status "$task_id" "$user_id"); then
        exit 1
    fi
    
    log_success "Task completed successfully!"
    
    # Download results if available
    local result_url
    result_url=$(echo "$final_response" | jq -r '.result_url // "N/A"')
    
    if [ "$result_url" != "N/A" ]; then
        download_results "$result_url" "$results_file"
    fi
    
    # Clean up
    if [ -f "$input_file" ]; then
        rm "$input_file"
        log_info "Cleaned up temporary files"
    fi
    
    log_success "Process completed successfully!"
}

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -f, --file FILE     Upload specific file instead of creating example"
    echo "  -k, --api-key KEY   Set API key (or use WHATSAPP_API_KEY env var)"
    echo "  -o, --output FILE   Set output file for results (default: whatsapp_results.xlsx)"
    echo "  -i, --interval SEC  Set polling interval in seconds (default: 5)"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  WHATSAPP_API_KEY   Your API key for the WhatsApp checker service"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run with example data"
    echo "  $0 -f my_numbers.txt                 # Upload specific file"
    echo "  $0 -f my_numbers.txt -o my_results.xlsx  # Upload file with custom output"
    echo "  WHATSAPP_API_KEY=your_key $0         # Set API key via environment"
    echo ""
    echo "WhatsApp Status Values:"
    echo "  yes  - WhatsApp account found"
    echo "  no   - No WhatsApp account associated with this number"
}

# Parse command line arguments
parse_args() {
    local custom_file=""
    local custom_output=""
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)
                custom_file="$2"
                shift 2
                ;;
            -k|--api-key)
                API_KEY="$2"
                shift 2
                ;;
            -o|--output)
                custom_output="$2"
                shift 2
                ;;
            -i|--interval)
                POLL_INTERVAL="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # If custom file provided, use it instead of creating example
    if [ -n "$custom_file" ]; then
        if [ ! -f "$custom_file" ]; then
            log_error "File not found: $custom_file"
            exit 1
        fi
        
        log_info "Using custom file: $custom_file"
        main_with_custom_file "$custom_file" "$custom_output"
    else
        main
    fi
}

# Main function for custom file
main_with_custom_file() {
    local input_file="$1"
    local results_file="${2:-whatsapp_results.xlsx}"
    
    log_info "WhatsApp Account Checker - Starting process with custom file"
    
    # Check dependencies and API key
    check_dependencies
    validate_api_key
    
    # Upload file
    local upload_response
    if ! upload_response=$(upload_file "$input_file"); then
        exit 1
    fi
    
    local task_id
    task_id=$(echo "$upload_response" | jq -r '.task_id')
    local user_id
    user_id=$(echo "$upload_response" | jq -r '.user_id')
    local initial_status
    initial_status=$(echo "$upload_response" | jq -r '.status')
    
    log_success "File uploaded successfully"
    log_info "Task ID: $task_id"
    log_info "Initial Status: $initial_status"
    
    # Poll for completion
    local final_response
    if ! final_response=$(poll_task_status "$task_id" "$user_id"); then
        exit 1
    fi
    
    log_success "Task completed successfully!"
    
    # Download results if available
    local result_url
    result_url=$(echo "$final_response" | jq -r '.result_url // "N/A"')
    
    if [ "$result_url" != "N/A" ]; then
        download_results "$result_url" "$results_file"
    fi
    
    log_success "Process completed successfully!"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [ $# -eq 0 ]; then
        main
    else
        parse_args "$@"
    fi
fi

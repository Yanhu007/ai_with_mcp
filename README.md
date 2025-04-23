# Azure OpenAI Chat

An Electron-based desktop application for chatting with Azure OpenAI models with streaming responses and Markdown rendering.

## Features

- Connect to Azure OpenAI API
- Configure Azure OpenAI API settings (endpoint, API key, deployment name)
- Stream responses in real-time
- Render responses in Markdown format
- Syntax highlighting for code blocks

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build TypeScript files:
   ```
   npm run build
   ```
4. Start the application:
   ```
   npm start
   ```

### Build for Production

To build the application for distribution:

```
npm run dist
```

This will create platform-specific installers in the `release` directory.

## Usage

1. Launch the application
2. Click the "Configure" button (⚙️) to set up your Azure OpenAI API details:
   - API Key
   - Endpoint URL
   - Deployment Name
   - API Version
3. Type your message in the input field and click "Send" or press Enter
4. View the streaming response in the chat window

## License

ISC
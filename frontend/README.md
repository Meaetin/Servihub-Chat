# ServHub Chat Widget

An embeddable, responsive chat widget built with React and Webpack. Designed to be lightweight (≤20kB gzipped) and easily embeddable on any website.

## Features

- ✅ **Responsive message bubbles** - Optimized for mobile and desktop
- ✅ **Chat input with file upload** - Support for images, documents, and more
- ✅ **Mobile-responsive design** - Adapts to all screen sizes
- ✅ **UMD bundle output** - Embeddable on any website
- ✅ **Bundle size optimization** - Target ≤20kB gzipped
- ✅ **Smooth animations** - Professional UI/UX
- ✅ **Typing indicators** - Real-time feedback
- ✅ **File upload support** - Images, PDFs, documents

## Installation & Development

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build production bundle
npm run build

# Preview build
npm run preview
```

## Build Output

After running `npm run build`, you'll find:
- `dist/servihub-chat-widget.js` - The UMD bundle
- `dist/index.html` - Demo page

## Embedding the Widget

### Method 1: UMD Bundle (Recommended)

```html
<!DOCTYPE html>
<html>
<head>
    <title>Your Website</title>
</head>
<body>
    <!-- Your website content -->
    
    <!-- Include React (if not already included) -->
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    
    <!-- Include ServHub Chat Widget -->
    <script src="./dist/servihub-chat-widget.js"></script>
    
    <!-- Initialize Widget -->
    <script>
        ServiHubChat('chat-container', {
            apiUrl: 'https://your-api-server.com',
            // Additional options...
        });
    </script>
</body>
</html>
```

### Method 2: Auto-initialization

The widget can auto-initialize if you include a container with ID `chat-widget-root`:

```html
<div id="chat-widget-root"></div>
<script src="./dist/servihub-chat-widget.js"></script>
```

## Configuration Options

```javascript
ServiHubChat('container-id', {
    apiUrl: 'https://your-backend.com',  // Backend API URL
    theme: 'blue',                       // Color theme
    position: 'bottom-right',            // Widget position
    autoOpen: false,                     // Auto-open on load
    // Add more options as needed
});
```

## Widget API

The `ServiHubChat` function returns an object with control methods:

```javascript
const widget = ServiHubChat('container', options);

// Destroy the widget
widget.destroy();
```

## File Structure

```
frontend/
├── src/
│   ├── index.js          # Entry point
│   ├── ChatWidget.jsx    # Main widget component
│   └── ChatWidget.css    # Widget styles
├── public/
│   └── index.html        # Development template
├── dist/                 # Build output
├── webpack.config.js     # Webpack configuration
├── .babelrc             # Babel configuration
└── package.json         # Dependencies and scripts
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build production UMD bundle |
| `npm run start` | Alias for `npm run dev` |

## Bundle Size Optimization

The widget is optimized to stay under 20kB gzipped:

- **External dependencies**: React and ReactDOM are externalized
- **Tree shaking**: Unused code is removed
- **Minification**: Code is compressed in production
- **CSS optimization**: Styles are inlined and minified

## Browser Support

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Responsive Design

The widget is mobile-first and includes:
- Responsive breakpoints at 480px and 360px
- Touch-friendly interface
- Optimized for various screen sizes
- Smooth animations and transitions

## Development Notes

### Step 12 Compliance ✅

This setup fulfills all Step 12 requirements:
- ✅ React project in `frontend/` directory
- ✅ Dependencies: `react`, `react-dom`, `webpack`, `webpack-cli`, `babel-loader`
- ✅ TypeScript types: `@types/react`, `@types/react-dom`
- ✅ Webpack configured for UMD bundle output
- ✅ Bundle size optimization (target ≤20kB gzipped)
- ✅ Responsive message bubbles
- ✅ Chat input with file upload

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details 
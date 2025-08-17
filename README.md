# My Notes and Tasks - Complete Feature & Capability List

A comprehensive overview of all features and capabilities across the frontend (React) and backend (Node.js/Express) repositories.

## 📱 **Application Overview**
- **Type**: Full-stack web application with mobile app capabilities
- **Purpose**: Hierarchical note-taking and task management system
- **Architecture**: React frontend + Node.js/Express backend + MongoDB database
- **Mobile Support**: Capacitor-based hybrid mobile app for Android
- **Current Version**: Frontend v15.4.0, Backend v9.8.0

---

## 🎨 **Frontend Features (React Application)**

### **Core User Interface**
- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices
- **Multi-theme Support**: Light, dark, and system-preference themes
- **Modern UI Framework**: Built with Tailwind CSS for clean, modern aesthetics
- **Accessibility Features**: Keyboard shortcuts and screen reader support
- **Error Boundary**: Graceful error handling with user-friendly error pages

### **Data Organization & Structure**
- **Hierarchical Tree View**: Nested folder structure for organizing notes, tasks, and folders
- **Three Content Types**:
  - **Notes**: Rich-text documents with full formatting support
  - **Tasks**: Checkable items with completion tracking
  - **Folders**: Containers for organizing other items
- **Drag & Drop Interface**: Intuitive reordering and moving items between folders
- **Context Menus**: Right-click menus for quick actions on tree items

### **Rich Text Editor (TipTap-based)**
- **Full WYSIWYG Editing**: Visual rich-text editor for notes and tasks
- **Formatting Options**:
  - Bold, italic, underline text styling
  - Headers (H1, H2, H3)
  - Bullet and numbered lists
  - Code blocks with syntax highlighting
  - Hyperlinks with automatic link detection
  - Text alignment (left, center, right, justify)
  - Font family selection
- **Image Support**:
  - Drag & drop image uploads
  - Resizable images within content
  - Image metadata stripping for security
- **Auto-saving**: Debounced automatic content saving with visual indicators

### **Task Management**
- **Task Creation**: Quick task creation within the tree structure
- **Completion Tracking**: Toggle task completion status directly from tree view
- **Task Reminders**: Built-in reminder system with notification support
- **Visual Task Status**: Clear visual indicators for completed vs. pending tasks

### **Search & Discovery**
- **Comprehensive Search Panel**: Full-text search across all content
- **Advanced Search Options**:
  - Case-sensitive search toggle
  - Whole-word matching
  - Live result previews
  - Search result highlighting
- **Search Scope**: Searches through note content, task descriptions, and item labels

### **Data Management & Backup**
- **Import/Export Functions**:
  - JSON export of entire data structure
  - Import functionality for data restoration
- **Automatic Backups**: Configurable auto-export settings
- **Undo/Redo System**: Built-in undo/redo for structural changes
- **Data Persistence**: Real-time synchronization with backend

### **User Preferences & Settings**
- **Centralized Settings Panel**: Easy access to all customization options
- **Theme Customization**: Light/dark mode with system preference detection
- **Editor Defaults**: Configurable default settings for new content
- **Auto-export Configuration**: Customizable backup frequency and settings

### **Mobile & Cross-Platform**
- **Capacitor Integration**: Hybrid mobile app for Android devices
- **Progressive Web App (PWA)**: Can be installed as a web app
- **Responsive Touch Interface**: Optimized for touch interactions
- **Local Notifications**: Support for reminder notifications on mobile

### **Performance & Testing**
- **Comprehensive Testing Suite**:
  - Jest unit tests
  - Playwright end-to-end tests
  - Cross-browser testing (Chrome, Firefox, Safari)
  - Mobile device testing (Android WebView, tablets)
  - Accessibility testing with axe-core
- **Performance Optimization**:
  - Vite build system for fast development and production builds
  - Code splitting and lazy loading
  - Optimized bundle sizes

---

## 🔧 **Backend Features (Node.js/Express API)**

### **Authentication & Security**
- **JWT-based Authentication**: Secure token-based authentication system
- **Dual Token System**: Access tokens + refresh tokens for enhanced security
- **Password Security**: bcrypt hashing with salt for password storage
- **Rate Limiting**: Protection against brute-force attacks on authentication endpoints
- **Security Headers**: Helmet.js implementation for common web vulnerabilities
- **Input Sanitization**: Protection against NoSQL injection and XSS attacks
- **CORS Configuration**: Configurable Cross-Origin Resource Sharing

### **RESTful API Architecture**
- **Comprehensive API Endpoints**:
  - Authentication routes (login, register, refresh, logout)
  - Items management (CRUD operations for notes, tasks, folders)
  - Image upload and management
  - User account management
  - Synchronization endpoints
  - Admin functionality
- **Swagger Documentation**: Interactive API documentation with OpenAPI specification
- **Postman Collection**: Ready-to-use API testing collection

### **Data Models & Database**
- **MongoDB Integration**: Flexible NoSQL database with Mongoose ODM
- **Data Models**:
  - User accounts with encrypted sensitive data
  - Hierarchical item structure (notes, tasks, folders)
  - Refresh token management
  - Device registration for push notifications
  - Push subscription management
- **Data Validation**: Express-validator for input validation and sanitization

### **File Management & Security**
- **Secure Image Uploads**:
  - File type validation and size limits
  - Multer middleware for multipart form handling
  - Sharp image processing for metadata stripping
  - Malicious file content detection
- **Automated Cleanup**: Cron jobs for removing orphaned files
- **File Storage**: Organized file system storage with proper naming conventions

### **Push Notifications & Real-time Features**
- **Web Push Notifications**: Support for browser push notifications
- **Firebase Cloud Messaging (FCM)**: Mobile push notification delivery
- **Socket.io Integration**: Real-time communication capabilities
- **Device Management**: Device registration and subscription handling

### **System Maintenance & Monitoring**
- **Automated Background Tasks**:
  - Scheduled cleanup of expired refresh tokens
  - Orphaned file removal
  - System health monitoring
- **Comprehensive Logging**:
  - Winston logging framework
  - Error logging to files (error.log, combined.log)
  - Structured logging with different log levels
- **Health Monitoring**: Heartbeat endpoints for system status

### **Payment Integration**
- **Paddle Payment Processing**: Webhook handling for subscription management
- **Subscription Management**: User subscription status tracking
- **Billing Integration**: Automated billing and subscription lifecycle management

### **Administrative Features**
- **Admin Panel Endpoints**: Administrative user management
- **User Analytics**: User activity and usage statistics
- **System Metrics**: Performance and usage monitoring
- **Beta Testing Support**: Beta user management and feature flags

### **Testing & Quality Assurance**
- **Comprehensive Test Suite**:
  - Jest unit tests
  - Integration tests
  - API endpoint testing with Supertest
  - MongoDB Memory Server for test isolation
- **Test Coverage**: Code coverage reporting
- **Continuous Integration**: GitHub Actions for automated testing

---

## 🚀 **Deployment & DevOps**

### **Build & Deployment**
- **Automated Build Scripts**: Multiple build configurations (production, debug)
- **Firebase Hosting**: Frontend deployment configuration
- **Android APK Generation**: Automated Android app building with Capacitor
- **Version Management**: Automated version synchronization between frontend and backend
- **Release Scripts**: Streamlined deployment and release processes

### **Development Tools**
- **Hot Reload Development**: Fast development with Vite and Nodemon
- **Code Quality Tools**:
  - ESLint for code linting
  - Prettier for code formatting
  - PostCSS for CSS processing
- **Build Optimization**: Production-ready builds with minification and compression

### **Monitoring & Analytics**
- **Error Tracking**: Centralized error handling and logging
- **Performance Monitoring**: Application performance tracking
- **Usage Analytics**: User behavior and feature usage tracking

---

## 🔮 **Planned Features (Roadmap)**

### **High Priority**
- **Enhanced Accessibility**: Full WCAG compliance for users with disabilities
- **Advanced Sorting**: Custom sorting options within folders
- **Multi-Select Operations**: Bulk actions for multiple items
- **Tagging System**: Keyword tagging and filtering
- **Task Reminders**: Enhanced notification system with recurring tasks

### **Medium Priority**
- **Table Support**: Rich table creation and editing in notes
- **Advanced Code Formatting**: Syntax highlighting for multiple programming languages
- **File Attachments**: Support for attaching various file types
- **Collaboration Features**: Sharing and collaborative editing
- **Custom Folder Icons**: Visual customization options

### **Long-term Vision**
- **AI Integration**: Content summarization and intelligent organization
- **Native Mobile Apps**: Dedicated iOS and Android applications
- **Browser Extensions**: Quick capture tools for Chrome, Firefox, Safari
- **Third-party Integrations**: Import from Trello, Evernote, and other services
- **External API**: Public API for third-party integrations

---

## 🛠 **Technical Specifications**

### **Frontend Technology Stack**
- **Framework**: React 18.3.1 with hooks and modern patterns
- **Build Tool**: Vite 7.0.0 for fast development and builds
- **Styling**: Tailwind CSS 3.4.15 with responsive design
- **Rich Text**: TipTap 2.12.0 editor with extensions
- **Icons**: Lucide React 0.503.0 icon library
- **Animation**: Framer Motion 12.18.1 for smooth animations
- **Mobile**: Capacitor 7.4.2 for hybrid mobile app development
- **Testing**: Jest + Playwright for comprehensive testing coverage

### **Backend Technology Stack**
- **Runtime**: Node.js with Express.js 4.21.1 framework
- **Database**: MongoDB with Mongoose 8.14.1 ODM
- **Authentication**: JWT with bcrypt password hashing
- **Security**: Helmet, rate limiting, CORS, input sanitization
- **File Processing**: Multer + Sharp for secure image handling
- **Documentation**: Swagger with OpenAPI specification
- **Logging**: Winston for structured logging
- **Scheduling**: node-cron for background tasks
- **Testing**: Jest with Supertest for API testing

### **Security Features**
- **Data Encryption**: Field-level encryption for sensitive user data
- **Token Security**: JWT with refresh token rotation
- **File Security**: Virus scanning and metadata stripping
- **API Security**: Rate limiting, input validation, SQL injection protection
- **Network Security**: HTTPS enforcement, secure headers, CORS policies

### **Performance Optimizations**
- **Frontend**: Code splitting, lazy loading, optimized bundles
- **Backend**: Database indexing, connection pooling, caching strategies
- **Images**: Automatic compression and optimization
- **API**: Efficient query patterns and response optimization

---

## 📋 **Prerequisites**

To run this project locally, you will need:

- **Node.js**: Version 14 or higher
- **npm** (or Yarn)
- **MongoDB**: A running instance of MongoDB (local or cloud-based)

---

## 🚀 **Project Setup**

### **Backend Setup**

1. **Clone the backend repository:**
    ```bash
    git clone https://github.com/dushkin/My-Notes-and-Tasks-Backend.git
    cd My-Notes-and-Tasks-Backend
    ```

2. **Install backend dependencies:**
    ```bash
    npm install
    ```

3. **Create an environment file:**
    Create a `.env` file in the backend directory and add the following required variables:
    ```env
    # The connection string for your MongoDB database
    MONGODB_URI=mongodb://localhost:27017/MyNotesAppDB

    # A strong, secret string for signing JWTs
    JWT_SECRET=your_super_secret_jwt_key

    # The port for the backend server to run on
    PORT=5001

    # Comma-separated list of allowed origins for CORS
    ALLOWED_ORIGINS=http://localhost:5173

    # (Optional) Set the lifetime for tokens
    # JWT_EXPIRES_IN=15m
    # REFRESH_TOKEN_EXPIRES_IN=7d
    ```

### **Frontend Setup**

1. **Clone the frontend repository:**
    ```bash
    git clone https://github.com/dushkin/My-Notes-and-Tasks.git
    cd My-Notes-and-Tasks
    ```

2. **Install frontend dependencies:**
    ```bash
    npm install
    ```
    
3. **(Optional) Frontend Environment File:**
    If your frontend needs to connect to a backend not on `http://localhost:5001`, create a `.env` file in the frontend root and add:
    ```env
    VITE_API_BASE_URL=http://your-backend-url/api
    ```

---

## 🎯 **Running the Application**

You need to run both the backend and frontend servers in separate terminals.

1. **Start the backend server:**
    From the `My-Notes-and-Tasks-Backend` directory:
    ```bash
    npm run dev
    ```
    The API server will start on the port defined in your `.env` file (e.g., 5001).

2. **Start the frontend server:**
    From the `My-Notes-and-Tasks` directory:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

---

## 📚 **API Documentation**

The backend includes comprehensive API documentation generated with Swagger. Once the backend server is running, you can view the interactive API documentation at:

`http://localhost:5001/api-docs`

Additionally, a **Postman collection** is available in the backend repository for easy API testing.

---

## 🔗 **Related Repositories**

- **Backend Repository**: [My-Notes-and-Tasks-Backend](https://github.com/dushkin/My-Notes-and-Tasks-Backend)
- **Frontend Repository**: [My-Notes-and-Tasks](https://github.com/dushkin/My-Notes-and-Tasks) (this repository)

---

## 📄 **License**

This project is licensed under  
**Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)**.  
You may read, copy and redistribute this code in any medium or format as-is,  
but you may not modify it or create derivative works.  
See the [LICENSE](./LICENSE) file for full details.

---

## 👤 **Author**

**TT** © 2025

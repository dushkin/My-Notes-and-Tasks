# Notes & Tasks App

A modern, secure, and feature-rich full-stack application for organizing notes and tasks in a hierarchical tree structure. This application is built with a focus on user experience and security, providing a responsive and intuitive interface for managing your personal or professional data.

## Table of Contents

- [Features](#features)
  - [Frontend Features](#frontend-features)
  - [Backend Features](#backend-features)
- [Future Features](#future-features)
- [Technology Stack](#technology-stack)
  - [Frontend](#frontend)
  - [Backend](#backend)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [License](#license)
- [Author](#author)

## Features

This application comes packed with a wide array of features designed to make note-taking and task management seamless and efficient.

### Frontend Features

-   **Hierarchical Organization**: Create, rename, and delete folders, notes, and tasks in a nested tree view.
-   **Drag & Drop**: Intuitively reorder items or move them between folders.
-   **Rich-Text Editing**: A full-featured TipTap-based editor for notes and tasks supporting styles, lists, links, code blocks, and resizable images.
-   **Task Management**: Create tasks and toggle their completion status directly from the tree view.
-   **Auto-Saving**: Content is saved automatically with debounced updates and a "Saving..." indicator.
-   **Context Menus & Keyboard Shortcuts**: Full-featured context menus and keyboard shortcuts (F2, Ctrl/Cmd+C/X/V, etc.) for rapid interaction.
-   **Comprehensive Search**: A powerful, full-text search panel with case-sensitivity, whole-word matching, and live result previews.
-   **Responsive Design & Theming**: A Tailwind CSS-powered UI that works beautifully on all devices, with light, dark, and system themes.
-   **Undo/Redo**: Never lose your structural changes with built-in undo and redo functionality for the tree.
-   **Data Management**: Robust import/export to JSON and configurable automatic backups.
-   **Settings Panel**: A centralized place to customize your experience, including theme, editor defaults, and auto-export settings.

### Backend Features

-   **Secure Authentication**: Employs a robust JWT (JSON Web Token) strategy with access and refresh tokens. Passwords are securely hashed using `bcrypt`.
-   **RESTful API**: A well-structured API for managing all user data, including notes, tasks, and user accounts.
-   **Data Persistence**: Uses MongoDB with Mongoose for flexible and scalable data storage.
-   **Advanced Security**:
    -   **Security Headers**: Implements `helmet` to protect against common web vulnerabilities.
    -   **Rate Limiting**: Protects against brute-force attacks on authentication and other key endpoints.
    -   **CORS**: Configurable Cross-Origin Resource Sharing to secure API access.
    -   **Input Sanitization**: Protects against NoSQL injection and XSS attacks.
-   **Secure Image Uploads**: Handles image uploads securely, including file type validation, size limits, and post-upload processing with `sharp` to strip potentially malicious metadata.
-   **Scheduled Tasks**: Includes cron jobs for regular maintenance, such as cleaning up orphaned image files and expired refresh tokens.
-   **Centralized Error Handling & Logging**: Features robust, centralized middleware for handling errors and detailed logging with `winston` for monitoring and debugging.

## Future Features

Here is a roadmap of planned features, prioritized to enhance the core experience and expand the application's capabilities.

### High Priority
-   **Accessibility (A11y)**: Ensure the application is fully compliant with WCAG guidelines to be usable by people with disabilities.
-   **Enhanced Sorting**: Allow users to define custom sorting for items within folders, including mixed types.
-   **Multi-Select in Tree**: Implement the ability to select multiple items in the tree to perform bulk actions (e.g., copy, delete, move).
-   **Tagging System**: Add support for tagging items with keywords and then filtering the tree view by those tags.
-   **Task Reminders & Repetitions**: Implement notifications and recurring options for tasks to help users stay on track.

### Medium Priority
-   **Editor Enhancements**:
    -   **Table Support**: Allow creating and pasting tables within the content editor.
    -   **Advanced Code Formatting**: Add support for syntax highlighting for various programming languages.
    -   **File Attachments**: Enable users to attach files (e.g., PDFs, documents) to notes.
-   **Collaboration & Sharing**:
    -   Allow users to share specific notes or folders with others for viewing or collaborative editing.
-   **Customization**:
    -   **Custom Folder Icons**: Allow users to assign unique icons to folders for better visual organization.
    -   **Upcoming Tasks View**: Create a dashboard or a dedicated view to show the next 5 most upcoming tasks.

### Low Priority & Long-Term
-   **AI Capabilities**: Integrate AI for features like summarizing notes, answering questions based on your content, or suggesting task organizations.
-   **Platform Expansion**:
    -   **Mobile Apps**: Develop native applications for iOS and Android for a seamless on-the-go experience.
    -   **Browser Extensions**: Create browser add-ons for Chrome, Firefox, and Safari for quick note-taking and clipping content from the web.
-   **Advanced Data Management**:
    -   **Third-Party Imports**: Add functionality to import data from other services like Trello, Evernote, etc.
    -   **External API**: Develop an external API to allow other applications to interact with a user's data programmatically.

## Technology Stack

### Frontend
-   **Framework**: React (with Vite)
-   **Styling**: Tailwind CSS
-   **Editor**: TipTap
-   **Icons**: Lucide React

### Backend
-   **Framework**: Express.js
-   **Database**: MongoDB (with Mongoose)
-   **Authentication**: JWT (jsonwebtoken), bcrypt
-   **File Handling**: Multer, Sharp
-   **Security**: Helmet, express-rate-limit, CORS, HPP, express-mongo-sanitize
-   **API Documentation**: Swagger (OpenAPI)
-   **Logging**: Winston
-   **Task Scheduling**: node-cron

## Prerequisites

To run this project locally, you will need:

-   **Node.js**: Version 14 or higher.
-   **npm** (or Yarn)
-   **MongoDB**: A running instance of MongoDB (local or cloud-based).

## Project Setup

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd my-notes-and-tasks-backend
    ```

2.  **Install backend dependencies:**
    ```bash
    npm install
    ```

3.  **Create an environment file:**
    Create a `.env` file in the `my-notes-and-tasks-backend` directory and add the following required variables:
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

### Frontend Setup

1.  **Navigate to the frontend directory** (from the root of the project):
    ```bash
    cd my-notes-and-tasks-modern 
    ```

2.  **Install frontend dependencies:**
    ```bash
    npm install
    ```
    
3.  **(Optional) Frontend Environment File:**
    If your frontend needs to connect to a backend not on `http://localhost:5001`, create a `.env` file in the frontend root and add:
    ```env
    VITE_API_BASE_URL=http://your-backend-url/api
    ```

## Running the Application

You need to run both the backend and frontend servers in separate terminals.

1.  **Start the backend server:**
    From the `my-notes-and-tasks-backend` directory:
    ```bash
    npm run dev
    ```
    The API server will start on the port defined in your `.env` file (e.g., 5001).

2.  **Start the frontend server:**
    From the `my-notes-and-tasks-modern` directory:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

## API Documentation

The backend includes API documentation generated with Swagger. Once the backend server is running, you can view the interactive API documentation at:

`http://localhost:5001/api-docs`

## License

This project is licensed under  
**Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)**.  
You may read, copy and redistribute this code in any medium or format as-is,  
but you may not modify it or create derivative works.  
See the [LICENSE](./LICENSE) file for full details.

## Author

**TT** © 2025

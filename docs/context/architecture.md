# NoTask System Architecture

## High-Level Overview

NoTask is a client-server application with real-time synchronization capabilities.

```
┌─────────────────────────────────────────┐
│         Client Layer                     │
│  ┌──────────┐  ┌──────────┐            │
│  │  Web App │  │ Android  │            │
│  │  (React) │  │   App    │            │
│  └────┬─────┘  └────┬─────┘            │
│       │             │                   │
│       └─────┬───────┘                   │
│             │                           │
└─────────────┼───────────────────────────┘
              │ HTTP + WebSocket
              │
┌─────────────┼───────────────────────────┐
│             ▼                           │
│      ┌──────────────┐                   │
│      │  API Server  │                   │
│      │  (Express)   │                   │
│      └──────┬───────┘                   │
│             │                           │
│      ┌──────┴───────┐                   │
│      │              │                   │
│      ▼              ▼                   │
│  ┌────────┐    ┌─────────┐             │
│  │MongoDB │    │Socket.IO│             │
│  │        │    │         │             │
│  └────────┘    └─────────┘             │
│   Server Layer                          │
└─────────────────────────────────────────┘
```

## Data Flow

### 1. Initial Load

```
User opens app → Frontend requests auth token → Backend validates JWT
                → Frontend fetches tree → Backend decrypts tree from MongoDB
                → Frontend renders UI → User sees tree
```

### 2. Create Item

```
User clicks "New Note" → Frontend sends POST /api/items
                      → Backend validates auth + input
                      → Backend adds item to tree in memory
                      → Backend saves encrypted tree to MongoDB
                      → Backend emits Socket.IO event: item_created
                      → Frontend updates local tree
                      → Other connected clients receive Socket.IO event
                      → Other clients update their local trees
```

### 3. Update Item (Rename)

```
User presses F2, edits label → Frontend sends PATCH /api/items/:id
                             → Backend fetches full user document
                             → Backend finds item in tree
                             → Backend validates (no name conflicts)
                             → Backend updates using $set (optimized)
                             → Backend emits Socket.IO event: item_updated
                             → Frontend updates local tree
                             → Other clients sync via Socket.IO
```

### 4. Real-time Sync (Multi-device)

```
Device A modifies item → Backend saves to DB
                       → Backend emits to user room: item_updated
                       → Device B Socket.IO client receives event
                       → Device B updates local tree state
                       → Device B UI re-renders with new data
```

## Component Responsibilities

### Frontend (React)

**Purpose**: User interface, client-side state, optimistic updates

**Key Components**:
- `useTree` hook - Tree state management, CRUD operations
- `Tree` component - Renders hierarchical structure
- `TipTapEditor` - Rich text editing
- `useSocket` hook - Real-time event handling
- `useAuth` hook - Authentication state

**State Management**:
- Tree stored in memory (React state)
- Optimistic updates (update UI before server confirms)
- Undo/redo history
- localStorage cache (with quota handling for large trees)

### Backend (Node.js + Express)

**Purpose**: API endpoints, business logic, data persistence, real-time broadcasting

**Key Components**:
- Controllers - Request handlers (itemsController, authController)
- Models - MongoDB schemas (User, Reminder)
- Routes - URL routing + validation
- Middleware - Auth, error handling, rate limiting
- Socket.IO - Real-time event broadcasting

**Data Storage**:
- MongoDB stores encrypted `notesTree` field on User model
- Field-level encryption for sensitive data
- Full document fetch required for decryption

### Database (MongoDB)

**Purpose**: Persistent storage with encryption

**Schema**:
```javascript
User {
  email: String (unique, indexed)
  password: String (hashed with bcrypt)
  notesTree: Array (encrypted with mongoose-field-encryption)
  createdAt: Date
  updatedAt: Date
}

Reminder {
  userId: ObjectId (ref: User)
  itemId: String
  reminderTime: Date
  message: String
  completed: Boolean
}
```

**Tree Structure** (within User.notesTree):
```javascript
[
  {
    id: UUID,
    label: String,
    type: 'note' | 'folder' | 'task',
    content: String (HTML),
    completed: Boolean (tasks only),
    direction: 'ltr' | 'rtl',
    version: Number,
    createdAt: Date,
    updatedAt: Date,
    children: Array (folders only)
  }
]
```

### Real-time Layer (Socket.IO)

**Purpose**: Broadcast changes to all connected devices for same user

**Connection Flow**:
```
Client connects → Server validates JWT
               → Server joins client to user-specific room: `user_{userId}`
               → Client listens for events (item_created, item_updated, etc.)
               → Server broadcasts to room when data changes
               → All clients in room receive event and update local state
```

**Events**:
- `tree_updated` - Full tree refresh
- `item_created` - New item added
- `item_updated` - Item modified
- `item_deleted` - Item removed
- `item_moved` - Item repositioned

## Security Architecture

### Authentication Flow

```
1. User registers/logs in
   → Backend hashes password (bcrypt)
   → Backend generates JWT access token (15 min)
   → Backend generates refresh token (7 days)
   → Frontend stores both in localStorage

2. API Request
   → Frontend includes: Authorization: Bearer <access_token>
   → Backend verifies JWT signature
   → Backend extracts userId from token
   → Backend processes request

3. Token Refresh
   → Access token expires (401 Unauthorized)
   → Frontend sends refresh token to /api/auth/refresh
   → Backend validates refresh token
   → Backend generates new access token
   → Frontend retries original request
```

### Data Encryption

**Field-level encryption** (mongoose-field-encryption):
- `notesTree` field encrypted at rest
- Encryption key: `DATA_ENCRYPTION_SECRET` env variable
- Automatic encryption on save, decryption on fetch
- **Requires full document fetch** - `.select()` breaks decryption

### Input Validation

**Layers**:
1. **express-validator** - Route-level validation (types, lengths, formats)
2. **validateItemNameMiddleware** - Business logic validation (forbidden chars, reserved names)
3. **DOMPurify** - XSS prevention for HTML content

**Example**:
```javascript
router.patch(
    '/:itemId',
    [
        param('itemId').isString(),
        body('label').optional().trim().isLength({ max: 255 }),
        validate
    ],
    validateItemNameMiddleware,
    sanitizeContent,  // XSS prevention
    updateItem
);
```

## Performance Optimizations

### Backend Optimizations

**MongoDB $set for Simple Updates**:
```javascript
// Fast - updates only label field
await User.updateOne(
    { _id: userId },
    { $set: { 'notesTree.0.label': 'New Label' } }
);

// Slower - replaces entire document
user.notesTree = updatedTree;
await user.save();
```

**When**:
- Use `$set` for label-only updates (1-2ms vs 1000ms+)
- Use `.save()` for complex updates (content, nested changes)

### Frontend Optimizations

**Lazy Loading**:
```javascript
const Editor = lazy(() => import('./components/editor/TipTapEditor'));
```

**Memoization**:
```javascript
const sortedTree = useMemo(() => sortItems(tree, sortBy), [tree, sortBy]);
```

**Virtual Scrolling**:
- For trees >100 items
- Uses `react-window` for efficient rendering

**localStorage Handling**:
- Graceful fallback when quota exceeded (>5MB)
- Falls back to memory-only storage (`window.treeData`)

## Deployment Architecture

### Frontend Hosting

**Platform**: Render (Static Site)
**URL**: https://notask.co
**Build**: Vite production build
**CDN**: Served via global CDN

**Build Process**:
```
Push to main → GitHub webhook → Render builds
            → npm run build → dist/ folder
            → Deploy to CDN → Live at notask.co
```

### Backend Hosting

**Platform**: Render (Web Service)
**URL**: https://my-notes-and-tasks-backend.onrender.com
**Runtime**: Node.js 18+
**Database**: MongoDB Atlas

**Deployment**:
```
Push to main → GitHub webhook → Render builds
            → npm install → node server.js
            → Service running on port 5001
```

### Environment Separation

**Development**:
- Frontend: `localhost:5173`
- Backend: `https://my-notes-and-tasks-backend-dev.onrender.com`

**Production**:
- Frontend: `https://notask.co`
- Backend: `https://my-notes-and-tasks-backend.onrender.com`

## Mobile Architecture (Capacitor)

### Build Process

```
Frontend React App → Vite builds to dist/
                   → npx cap sync android
                   → Copies dist/ to android/app/src/main/assets/public
                   → Android Studio builds APK
                   → Install on device
```

### Native Bridge

**Capacitor** provides:
- JavaScript ↔ Native communication
- Plugin system for native features
- WebView container for React app

**Plugins Used**:
- `@capacitor/app` - App lifecycle events
- `@capacitor/local-notifications` - Push notifications

### Mobile-Specific Considerations

- Touch events (swipe, long-press)
- Native back button handling
- App backgrounding (save state)
- Offline functionality (IndexedDB)

## Error Handling Strategy

### Backend Error Flow

```
Error occurs → catchAsync wrapper catches
            → AppError with statusCode thrown
            → globalErrorHandler middleware
            → JSON response to client
            → Client displays error message
```

### Frontend Error Flow

```
API request fails → catch block in authFetch
                 → Check if 401 (token expired)
                 → If yes: attempt token refresh
                 → If refresh succeeds: retry request
                 → If refresh fails: redirect to login
                 → If other error: display error notification
```

## Scalability Considerations

### Current Limitations

- Single MongoDB instance (not sharded)
- Socket.IO runs on single server (no clustering)
- All tree data loaded in memory at once

### Future Scaling Paths

**Horizontal Scaling**:
- Use Redis adapter for Socket.IO clustering
- MongoDB sharding by userId
- Load balancer for multiple backend instances

**Data Partitioning**:
- Lazy load tree branches (don't fetch all at once)
- Paginate large folders
- Separate hot/cold data (recent vs archived)

**Caching**:
- Redis cache for frequently accessed trees
- CDN caching for static assets
- Service worker for offline caching

## Monitoring & Observability

### Logging

**Backend (Winston)**:
- Info: User actions, API requests
- Warn: Validation failures, not found errors
- Error: Database errors, server crashes

**Production (Render)**:
- Winston logs to files (not console)
- Use `console.log()` alongside logger for dashboard visibility

### Metrics to Track

- API response times (p50, p95, p99)
- Database query times
- Socket.IO connection count
- Error rates by endpoint
- User tree size distribution

## Known Architectural Constraints

1. **Encryption Requirement**: Must fetch full user document - no `.select()` projections
2. **Tree Size**: Large trees (>5MB) exceed localStorage quota
3. **Real-time Sync**: Single server limits Socket.IO to ~10K concurrent connections
4. **Mobile Build**: Requires Android SDK + Gradle locally
5. **Offline Mode**: Limited to cached data, no conflict resolution yet

## Agent Coordination Points

### Frontend ↔ Backend

**Interface**: REST API + Socket.IO
**Contract**: Defined in [dependencies.json](dependencies.json)
**Coordination**: Frontend sends requests, Backend validates + persists + broadcasts

### Backend ↔ Database

**Interface**: Mongoose models
**Encryption**: Field-level via plugin (requires full document fetch)
**Transactions**: Not currently used (single document updates)

### Real-time ↔ All Clients

**Interface**: Socket.IO events
**Room Strategy**: One room per user (`user_{userId}`)
**Event Types**: CRUD operations (create, update, delete, move)

---

**This document is for Orchestrator and high-level coordination.** For implementation details, see module-specific `.claude.md` files.

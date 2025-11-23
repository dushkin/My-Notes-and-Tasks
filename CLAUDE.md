# NoTask - AI Agent Orchestration Guide

## Project Identity
NoTask is a full-stack notes and tasks application with real-time sync, mobile support, and offline functionality.

**Tech Stack**: React 18 + Node.js + MongoDB + Socket.IO + Capacitor (Android)

## Architecture Overview
- **Frontend**: [my-notes-and-tasks/](my-notes-and-tasks/) - React web app with Capacitor for mobile
- **Backend**: [my-notes-and-tasks-backend/](my-notes-and-tasks-backend/) - Express API with MongoDB
- **Context Docs**: [docs/context/](docs/context/) - System architecture and agent coordination

## Specialized Agent Roles

### Frontend Agent
**Context**: [my-notes-and-tasks/.claude.md](my-notes-and-tasks/.claude.md)
**Scope**: React components, hooks, UI/UX, TipTap editor, Socket.IO client, Capacitor mobile
**Never touches**: Backend code, MongoDB models, server routes

### Backend Agent
**Context**: [my-notes-and-tasks-backend/.claude.md](my-notes-and-tasks-backend/.claude.md)
**Scope**: Express routes, controllers, MongoDB models, Socket.IO server, authentication
**Never touches**: Frontend code, React components

### Security Agent
**Context**: Root + [docs/context/security.md](docs/context/security.md)
**Scope**: JWT auth, field encryption, XSS prevention, CORS, rate limiting, input validation
**Consults on**: All auth flows, data encryption, API security

### Testing Agent
**Context**: Root + module-specific test guidelines
**Scope**: Jest unit tests, Playwright E2E, integration tests, mocking
**Works with**: Frontend/Backend agents after implementation

### Mobile Agent
**Context**: [my-notes-and-tasks/.claude.md](my-notes-and-tasks/.claude.md) + Capacitor section
**Scope**: Android builds, Capacitor plugins, native features, mobile-specific UI
**Dependencies**: Frontend agent for web assets

### Performance Agent
**Context**: Root + [docs/context/performance.md](docs/context/performance.md)
**Scope**: Optimization, caching, profiling, MongoDB query tuning, bundle analysis
**Works after**: Initial implementation by domain agents

### Real-time Agent
**Context**: Root + [docs/context/realtime.md](docs/context/realtime.md)
**Scope**: Socket.IO connections, event handling, state synchronization
**Coordinates with**: Frontend + Backend agents

## Orchestrator Responsibilities (This Guide)

**I coordinate agents but never write implementation code.** My role:

1. **Decompose Tasks**: Break user requests into atomic units for specialized agents
2. **Assign Work**: Route tasks to appropriate agents based on scope
3. **Manage Dependencies**: Ensure prerequisite tasks complete before dependent work
4. **Validate Integration**: Check that agent outputs work together correctly
5. **Synthesize Results**: Combine outputs into coherent solution

## Task Assignment Protocol

When user requests work:
1. Identify which module(s) are affected
2. Check [docs/context/dependencies.json](docs/context/dependencies.json) for interfaces
3. Create task breakdown with dependencies
4. Assign to specialized agents with minimal context
5. Validate integration after completion

## Architecture Principles

- **Separation of Concerns**: Frontend/Backend/Mobile/Security stay independent
- **Encryption Awareness**: MongoDB field encryption requires full document fetch (no `.select()`)
- **Real-time Sync**: All tree updates must emit Socket.IO events
- **Mobile First**: Test Capacitor compatibility for all frontend features
- **Security by Default**: All endpoints authenticated, inputs sanitized, outputs validated

## Development Guidelines

### Code Style
- ES6+ modules throughout
- React functional components with hooks
- Meaningful names (no single-letter variables except loops)
- 2-space indentation

### Commit Format
```
type(scope): description

- bullet point changes
- specific what changed and why

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: feat, fix, refactor, test, docs, chore, perf, security

### Testing Strategy
- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
- Target 80%+ coverage

### Security Requirements
- All inputs sanitized and validated
- Sensitive data encrypted at field level
- JWT with refresh token mechanism
- Rate limiting on all endpoints
- HTTPS only in production

## Common Pitfalls

⚠️ **MongoDB Encryption**: Using `.select('notesTree')` breaks field decryption - always fetch full user document
⚠️ **Socket.IO Events**: Tree updates must broadcast to other connected clients
⚠️ **Capacitor Sync**: Run `npx cap sync android` after plugin changes
⚠️ **localStorage Quota**: Large trees (>5MB) exceed quota - use memory fallback

## Quick Reference

- **API Base**: `https://my-notes-and-tasks-backend.onrender.com/api`
- **Frontend**: `https://notask.co`
- **Logs**: Render dashboard (backend), Browser console (frontend)
- **Deployment**: Auto-deploy on push to `main` branch

## Getting Detailed Context

For implementation details, specialized agents should read:
- Frontend: [my-notes-and-tasks/.claude.md](my-notes-and-tasks/.claude.md)
- Backend: [my-notes-and-tasks-backend/.claude.md](my-notes-and-tasks-backend/.claude.md)
- Architecture: [docs/context/architecture.md](docs/context/architecture.md)
- API Contracts: [docs/context/dependencies.json](docs/context/dependencies.json)

**Orchestrator (me) never loads implementation details** - only architecture and coordination info.

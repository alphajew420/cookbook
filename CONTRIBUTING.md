# Contributing to Cookbook App Backend

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other contributors

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/cookbook-app-backend.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes
6. Commit and push
7. Create a Pull Request

## Development Setup

See [SETUP.md](SETUP.md) for detailed setup instructions.

## Coding Standards

### JavaScript Style Guide

- Use ES6+ features
- Use `const` and `let`, never `var`
- Use async/await instead of callbacks
- Use meaningful variable names
- Add comments for complex logic
- Follow existing code style

### Code Formatting

We use Prettier for code formatting:

```bash
npm run format
```

### Linting

We use ESLint for code quality:

```bash
npm run lint
```

## Testing

All new features must include tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Test Coverage

Maintain minimum coverage:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Commit Messages

Follow conventional commits:

```
feat: add recipe sharing feature
fix: resolve authentication bug
docs: update API documentation
test: add tests for fridge controller
refactor: improve matching algorithm
chore: update dependencies
```

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Request review from maintainers

## Project Structure

```
src/
├── controllers/    # Request handlers
├── database/       # Database config and migrations
├── middleware/     # Express middleware
├── routes/         # API routes
├── services/       # Business logic
├── utils/          # Utility functions
└── server.js       # Main application
```

## Adding New Features

### 1. Create an Issue

Describe the feature and get feedback before starting.

### 2. Implement the Feature

Follow existing patterns and conventions.

### 3. Add Tests

Write comprehensive tests for your feature.

### 4. Update Documentation

Update README.md, API_EXAMPLES.md, or other relevant docs.

## Bug Reports

Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error logs

## Questions?

- Open an issue
- Contact maintainers
- Check existing documentation

Thank you for contributing! 🎉

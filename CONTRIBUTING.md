# Contributing to the Project

Thank you for your interest in contributing! Here are some guidelines:

## How to Contribute

1. **Fork** the project
2. Create a **branch** for your feature (`git checkout -b feature/MyFeature`)
3. **Commit** your changes (`git commit -m 'Add MyFeature'`)
4. **Push** to the branch (`git push origin feature/MyFeature`)
5. Open a **Pull Request**

## Guidelines

- Follow the existing code style
- Test your code before submitting a PR
- Document significant changes
- Be respectful and constructive in comments

## Local Setup for Development

```bash
# Clone the repository
git clone https://github.com/JustFire17/Key_VALUE.git
cd Key_VALUE

# Copy the environment example file
cp .env.example .env

# Install dependencies
cd api && npm install && cd ..
cd consumer && npm install && cd ..

# Start Docker Compose
docker compose up -d

# Start the API
cd api && npm start

# In another terminal, start the Consumer
cd consumer && npm start
```

## Running Tests

```bash
# Consistency tests
./consistency_test.sh

# Load tests
./load_test.sh
```

## Issues?

Open an **issue** describing:
- The problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, versions)

Thank you!


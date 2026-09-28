# Ali Asset Bank

A production-ready mobile-first banking web application built in React + Express with secure file-based financial storage.

## Tech stack

- Frontend: React + Vite + Tailwind CSS + Lucide icons
- Backend: Node.js + Express
- Storage: secure JSON-backed financial store with transaction safety checks
- Security: JWT, bcrypt, PIN locking, biometric toggle, idempotency keys

## Features

- Secure login and registration
- 3-attempt PIN lockout protection
- Dashboard with balance privacy toggle and live transaction feed
- P2P transfers with validation and PIN confirmation
- QR merchant payment module
- Cardless ATM withdrawal flow with code generation
- Statements and disputes

## Getting started

```bash
git clone https://github.com/lulkoangpuok26-cloud/neo-bank-app.git
cd neo-bank-app
npm install
npm run dev
```

Demo credentials:
- Email: demo@aliasset.app
- Password: AliBank#2025
- PIN: 123456

## Notes

This project is structured for local development and can be extended to SQLite/Prisma for production deployments.

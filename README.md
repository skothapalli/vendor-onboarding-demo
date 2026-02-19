# VOMS - Vendor Onboarding Management System

A comprehensive enterprise-grade vendor onboarding system with compliance management, workflow approvals, and full auditability.

## Features

- **Vendor Management**: Register, update, approve/reject, and terminate vendors
- **Compliance Checklists**: Configurable templates with item tracking
- **Workflow Engine**: Multi-level approval with delegation and escalation
- **Document Management**: Upload, versioning, and expiration tracking
- **Resubmission Flow**: Support for rejected vendor resubmission
- **Audit Logging**: Immutable audit trail with hash chain integrity
- **RBAC**: Role-based access control with scoped permissions
- **SOC2 & GDPR Ready**: Built with compliance requirements in mind

## Tech Stack

- **Runtime**: Node.js 20 LTS
- **Language**: TypeScript 5.x
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Testing**: Jest + Supertest
- **Containerization**: Docker

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15 (or use Docker)
- Redis 7 (or use Docker)

### Local Development

1. **Clone and install dependencies**
   ```bash
   cd voms
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start infrastructure with Docker**
   ```bash
   npm run docker:up
   ```

4. **Run database migrations**
   ```bash
   npm run prisma:migrate
   ```

5. **Seed the database**
   ```bash
   npm run prisma:seed
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000/api/v1`

### Default Admin Credentials

- Email: `admin@voms.local`
- Password: `Admin123!`

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Current user info

### Vendors
- `POST /api/v1/vendors` - Create vendor
- `GET /api/v1/vendors` - List vendors
- `GET /api/v1/vendors/:id` - Get vendor
- `PUT /api/v1/vendors/:id` - Update vendor
- `POST /api/v1/vendors/:id/submit` - Submit for approval
- `POST /api/v1/vendors/:id/approve` - Approve vendor
- `POST /api/v1/vendors/:id/reject` - Reject vendor
- `POST /api/v1/vendors/:id/terminate` - Terminate vendor

### Resubmission
- `GET /api/v1/vendors/:id/resubmission/eligibility` - Check eligibility
- `POST /api/v1/vendors/:id/resubmission/initiate` - Initiate resubmission
- `POST /api/v1/vendors/:id/resubmission/:resubmissionId/submit` - Submit resubmission
- `GET /api/v1/vendors/:id/resubmission/history` - Resubmission history

### Compliance
- `POST /api/v1/compliance/templates` - Create template
- `GET /api/v1/compliance/templates` - List templates
- `POST /api/v1/compliance/vendors/:vendorId/assign` - Assign checklist
- `GET /api/v1/compliance/vendors/:vendorId` - Get vendor compliance
- `PUT /api/v1/compliance/items/:id/status` - Update item status

### Workflows
- `POST /api/v1/workflows/config` - Create workflow config
- `GET /api/v1/workflows/pending` - Get pending approvals
- `POST /api/v1/workflows/steps/:id/approve` - Approve step
- `POST /api/v1/workflows/steps/:id/reject` - Reject step
- `POST /api/v1/workflows/delegate` - Delegate approval

### Audit
- `GET /api/v1/audit/trail` - Full audit trail (admin/auditor)
- `GET /api/v1/audit/compliance/trail` - Compliance audit trail (restricted)
- `GET /api/v1/audit/entity/:entityType/:entityId` - Entity audit history
- `POST /api/v1/audit/verify` - Verify integrity

### Health
- `GET /api/v1/health/live` - Liveness check
- `GET /api/v1/health/ready` - Readiness check

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage
```

## Background Jobs

```bash
# Approval reminder (daily)
npm run jobs:reminder

# Approval escalation (hourly)
npm run jobs:escalation

# Document expiration check (daily)
npm run jobs:expiration

# Audit integrity verification (daily)
npm run jobs:audit
```

## Project Structure

```
voms/
├── src/
│   ├── api/
│   │   ├── controllers/     # Request handlers
│   │   ├── middlewares/     # Express middlewares
│   │   ├── routes/          # Route definitions
│   │   └── validators/      # Zod schemas
│   ├── config/              # Configuration
│   ├── domain/
│   │   └── enums/           # Domain enums
│   ├── infrastructure/
│   │   ├── cache/           # Redis client
│   │   └── database/        # Prisma client
│   ├── jobs/                # Background jobs
│   ├── services/            # Business logic
│   │   ├── audit/
│   │   ├── auth/
│   │   ├── compliance/
│   │   ├── vendor/
│   │   └── workflow/
│   └── utils/               # Utilities
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Seed data
├── tests/
│   ├── unit/
│   ├── integration/
│   └── helpers/
├── docker/
├── .github/workflows/       # CI/CD
└── docker-compose.yml
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | development |
| `PORT` | Server port | 3000 |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `JWT_SECRET` | JWT signing secret | - |
| `ENCRYPTION_KEY` | 32-byte encryption key | - |
| `RESUBMISSION_MAX_ATTEMPTS` | Max resubmission attempts | 3 |
| `RESUBMISSION_COOLDOWN_DAYS` | Days between resubmissions | 7 |

## License

Proprietary - All rights reserved

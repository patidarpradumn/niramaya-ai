# MediGuard AI - Specification Document

## 1. Project Overview

**Project Name:** MediGuard AI  
**Type:** Public Healthcare Resource & Supply-Chain Intelligence Platform  
**Core Functionality:** AI-powered decision-support platform for public healthcare supply-chain resilience, providing predictions, risk detection, alerts, and recommendations with human-in-the-loop approval.  
**Target Users:** Government health officials, facility administrators, authorized healthcare personnel

---

## 2. Technical Architecture

### Frontend
- **Framework:** React 18+ with TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **State Management:** React Context + Hooks
- **HTTP Client:** Axios

### Backend
- **Framework:** Python FastAPI
- **Database:** PostgreSQL with SQLAlchemy ORM
- **Authentication:** JWT (JSON Web Tokens)
- **API Style:** RESTful

### AI Integration
- **Provider:** Google Gemini API
- **Purpose:** Natural-language explanations, summaries, and queries

### ML Engine
- **Interface:** Clean service interface (mock provider for development)
- **Purpose:** Forecasting, predictions, risk detection

---

## 3. UI/UX Specification

### Color Palette
| Role | Color | Hex |
|------|-------|-----|
| Primary | Deep Teal | #0D7377 |
| Primary Dark | Dark Teal | #095456 |
| Secondary | Warm Coral | #E85A4F |
| Accent | Golden Yellow | #F5B041 |
| Background | Off-White | #F8F9FA |
| Surface | White | #FFFFFF |
| Text Primary | Charcoal | #212529 |
| Text Secondary | Gray | #6C757D |
| Success | Green | #28A745 |
| Warning | Amber | #FFC107 |
| Error | Red | #DC3545 |
| Border | Light Gray | #DEE2E6 |

### Typography
- **Primary Font:** Inter (headings and body)
- **Monospace:** JetBrains Mono (data, codes)
- **Heading Sizes:** H1: 32px, H2: 24px, H3: 20px, H4: 16px
- **Body:** 14px regular, 16px for emphasis

### Layout Structure
- **Sidebar:** 260px fixed width, collapsible on mobile
- **Main Content:** Fluid, max-width 1440px
- **Header:** 64px height with user menu
- **Cards:** 16px padding, 8px border-radius, subtle shadow
- **Responsive Breakpoints:** Mobile (<768px), Tablet (768-1024px), Desktop (>1024px)

### Visual Effects
- **Card Shadows:** `0 2px 8px rgba(0,0,0,0.08)`
- **Hover Shadows:** `0 4px 16px rgba(0,0,0,0.12)`
- **Transitions:** 200ms ease for all interactive elements
- **Focus Ring:** 2px solid #0D7377 with 2px offset

---

## 4. Core Features

### 4.1 Authentication System
- User login with email/password
- JWT token-based authentication
- Role-based access control (Admin, Facility Manager, Viewer)
- Session management with refresh tokens
- Password hashing with bcrypt

### 4.2 Dashboard
- Overview of supply-chain health metrics
- Risk alerts summary
- Key performance indicators (KPIs)
- Quick action buttons
- Recent activity feed

### 4.3 Inventory Management
- View facility inventory levels
- Track supplies by category (Medications, Equipment, Consumables)
- Stock level indicators (Critical, Low, Adequate, Overstocked)
- Historical stock trends

### 4.4 ML Predictions & Risk Detection
- Demand forecasting display
- Risk alerts with severity levels
- Supply chain vulnerability indicators
- Recommended actions

### 4.5 AI Assistant
- Natural language queries about supply chain
- AI-generated explanations for predictions
- Summary generation for reports
- Context-aware responses

### 4.6 Alerts & Notifications
- Real-time risk alerts
- Configurable alert thresholds
- Alert history and acknowledgment
- Severity-based categorization (Critical, High, Medium, Low)

### 4.7 Reporting
- Export functionality (CSV, PDF placeholder)
- Summary reports generation
- AI-enhanced report explanations

---

## 5. API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users/me` - Current user profile
- `PUT /api/users/me` - Update profile

### Facilities
- `GET /api/facilities` - List facilities
- `GET /api/facilities/{id}` - Facility details

### Inventory
- `GET /api/inventory` - List inventory items
- `GET /api/inventory/{id}` - Item details
- `PUT /api/inventory/{id}` - Update stock level

### Predictions
- `GET /api/predictions/demand` - Get demand forecasts
- `GET /api/predictions/risk` - Get risk assessments

### Alerts
- `GET /api/alerts` - List alerts
- `PUT /api/alerts/{id}/acknowledge` - Acknowledge alert

### AI
- `POST /api/ai/query` - Query AI assistant
- `POST /api/ai/explain` - Explain prediction

---

## 6. Database Schema

### Users
- id, email, password_hash, full_name, role, facility_id, created_at, updated_at

### Facilities
- id, name, location, type, contact_email, created_at, updated_at

### Inventory
- id, facility_id, item_name, category, unit, current_stock, min_threshold, max_threshold, last_updated

### Alerts
- id, facility_id, severity, title, description, acknowledged, created_at, acknowledged_at

### Predictions
- id, facility_id, item_id, predicted_demand, confidence, predicted_date, created_at

### AuditLogs
- id, user_id, action, entity_type, entity_id, details, created_at

---

## 7. Security Requirements

1. All API endpoints except /auth/login require valid JWT
2. Role-based access control enforced at API level
3. Passwords hashed with bcrypt (12 rounds)
4. JWT tokens expire in 30 minutes, refresh in 7 days
5. CORS configured for frontend origin only
6. Input validation on all endpoints
7. SQL injection prevention via SQLAlchemy ORM
8. Sensitive inventory data not exposed to viewer role

---

## 8. Acceptance Criteria

### Authentication
- [ ] Users can log in with valid credentials
- [ ] Invalid credentials show error message
- [ ] JWT token is returned and stored
- [ ] Protected routes redirect to login when unauthenticated

### Dashboard
- [ ] Dashboard displays summary KPIs
- [ ] Recent alerts are visible
- [ ] Quick navigation to key sections works

### Inventory
- [ ] Inventory list loads with correct data
- [ ] Stock level indicators show appropriate colors
- [ ] Search and filter functionality works

### Alerts
- [ ] Alerts display with severity indicators
- [ ] Acknowledge button works
- [ ] Alert history is maintained

### AI Assistant
- [ ] Query input accepts natural language
- [ ] Response displays AI-generated content
- [ ] Error states handled gracefully

### General
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Loading states displayed during API calls
- [ ] Error messages user-friendly
- [ ] Navigation is intuitive

---

## 9. Project Structure

```
mediguard-ai/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Configuration
│   │   ├── database.py          # Database setup
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── routers/             # API endpoints
│   │   ├── services/            # Business logic
│   │   └── utils/               # Utilities
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── pages/               # Page components
│   │   ├── services/            # API services
│   │   ├── hooks/               # Custom hooks
│   │   ├── context/             # React context
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Utilities
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```
# NIRAMAYA AI --- COMPLETE FRONTEND MASTER PROMPT

> **Purpose:** Give this entire file to Claude Code as the master
> specification for designing and implementing the complete NIRAMAYA AI
> frontend.
>
> **Primary visual reference:** The four NIRAMAYA AI UI screenshots
> provided with this project. They define the visual language,
> hierarchy, spacing, typography direction, navigation behavior, charts,
> cards, colors, and overall product feel.

------------------------------------------------------------------------

## 0. EXECUTION RULE

You are the **Lead Product Designer + Senior Frontend Engineer**
responsible for designing and implementing the complete frontend of:

# NIRAMAYA AI

### INTELLIGENCE FOR A HEALTHIER NATION

Build a **complete, polished, production-quality, hackathon-ready
frontend**.

This is NOT a simple admin dashboard.

The product must feel like a sophisticated:

**National Healthcare Intelligence & Resource Command Center**

### Non-negotiable execution behavior

-   Inspect the existing repository before changing anything.
-   Reuse useful existing code, components, assets, routing, and
    dependencies.
-   Do not unnecessarily rewrite working functionality.
-   Do not stop at scaffolding.
-   Do not create empty placeholder pages when a real UI can be
    implemented.
-   Implement all required routes and interactions.
-   Use realistic **clearly demo/mock** data when APIs are unavailable.
-   Keep mock data separate from API services.
-   Run the application/build/checks after implementation.
-   Fix errors found during verification.
-   Do not ask unnecessary questions; make sensible product decisions.
-   Do not claim a feature works if it is only a visual placeholder.
-   Do not build ML models, PostgreSQL, or cloud infrastructure unless
    explicitly requested separately.
-   Keep the frontend ready for backend/ML/Gemini integration.

------------------------------------------------------------------------

# 1. PRODUCT CONTEXT

NIRAMAYA AI is an:

**AI-powered Public Healthcare Resource & Supply-Chain Intelligence
Platform**

It helps authorized government and healthcare administrators:

-   monitor healthcare facilities
-   monitor healthcare resources
-   identify predicted shortage risks
-   identify expiry risks
-   monitor equipment issues
-   analyze resource pressure
-   understand demand forecasts
-   identify potential redistribution opportunities
-   review AI-generated insights
-   review recommendations
-   approve/reject/modify proposed actions
-   maintain an auditable operational workflow

NIRAMAYA AI is a **decision-support system**.

It is NOT:

-   a medical diagnosis system
-   a medicine prescription system
-   an autonomous government decision-maker
-   a replacement for doctors or healthcare professionals

### Safe terminology

Use:

-   Predicted shortage risk
-   Estimated demand
-   Forecasted requirement
-   Potential redistribution opportunity
-   AI-generated insight
-   Decision support
-   Estimated transit
-   Confidence, only when actually provided

Avoid:

-   Guaranteed shortage
-   Guaranteed demand
-   AI automatically decided
-   AI approved
-   AI prescribed

------------------------------------------------------------------------

# 2. CORE SYSTEM WORKFLOW

The conceptual system flow is:

``` text
Facility / Operational Data
          ↓
       Backend
          ↓
      PostgreSQL
          ↓
    External ML Engine
          ↓
      Predictions
          ↓
    Risk Detection
          ↓
 Alerts & Recommendations
          ↓
 Gemini AI Explanations
          ↓
 Authorized Human Review
          ↓
  Approve / Reject / Modify
          ↓
       Audit Log
```

The frontend must communicate this workflow clearly.

------------------------------------------------------------------------

# 3. RESPONSIBILITY BOUNDARY

## Frontend owns

-   Login UI
-   Application shell
-   Navigation
-   Role-aware UX
-   Government dashboard
-   Facilities
-   Facility details
-   Inventory
-   Expiry intelligence
-   Alerts
-   Predictions
-   Redistribution workflow
-   Equipment intelligence
-   Government AI assistant
-   Citizen portal
-   Citizen AI assistant
-   Charts
-   Tables
-   Filters
-   Search
-   Modals/drawers
-   Loading states
-   Error states
-   Empty states
-   Toasts
-   Responsive behavior
-   Accessibility
-   API integration layer
-   Mock/demo data layer

## Do NOT implement as frontend logic

-   ML model training
-   forecasting algorithms
-   PostgreSQL database implementation
-   cloud infrastructure
-   autonomous government decisions
-   direct secret/API-key exposure
-   real government data fabrication

------------------------------------------------------------------------

# 4. TECH STACK

Prefer the existing repository stack.

Preferred:

-   React
-   TypeScript
-   Tailwind CSS
-   React Router
-   Recharts

Use:

-   reusable components
-   strongly typed data
-   service/API abstraction
-   clean folder structure
-   scalable component architecture

Do not add unnecessary libraries.

If an equivalent library is already present and working, reuse it.

------------------------------------------------------------------------

# 5. PRIMARY UI REFERENCE

The four uploaded screenshots are the **PRIMARY visual reference**.

Use them to establish:

-   page composition
-   card hierarchy
-   typography
-   spacing
-   navigation
-   chart treatment
-   filters
-   status badges
-   button style
-   color language
-   overall density
-   responsive behavior
-   government-healthcare visual identity

Do NOT blindly copy them pixel-for-pixel.

Expand the same design language into the complete NIRAMAYA AI product.

The screenshots show a refined light interface with:

-   white/off-white content surfaces
-   deep navy branding
-   strong government blue
-   red critical status
-   yellow/olive warning status
-   blue stable status
-   restrained shadows
-   rounded cards
-   clean borders
-   premium headings
-   compact supporting text
-   strong information hierarchy

------------------------------------------------------------------------

# 6. DESIGN LANGUAGE

## Overall style

**Premium Government Healthcare Intelligence**

Keywords:

-   sophisticated
-   calm
-   intelligent
-   trustworthy
-   modern
-   institutional
-   premium
-   data-centric
-   precise
-   clean
-   high-information but uncluttered

It should look like software used by a national healthcare operations
team.

------------------------------------------------------------------------

# 7. COLOR SYSTEM

### Primary

-   Deep navy
-   Government blue
-   Medical/royal blue

### Surfaces

-   White
-   Off-white
-   Very light neutral gray
-   Soft blue-gray where appropriate

### Text

-   Deep navy/charcoal
-   Muted gray for secondary information

### Status

-   Blue = stable/information
-   Green = healthy/operational
-   Amber/yellow = warning/elevated risk
-   Red = critical/high risk

### AI

-   Subtle cyan/teal accents

### Do NOT use

-   purple AI theme
-   cyberpunk palette
-   gaming aesthetic
-   excessive neon
-   rainbow dashboards
-   random gradients

Color must communicate meaning, not decoration.

------------------------------------------------------------------------

# 8. TYPOGRAPHY

Create a strong visual hierarchy.

Page titles:

-   authoritative
-   premium
-   highly readable

Supporting text:

-   clean
-   compact
-   easy to scan

Use a refined combination of:

-   modern sans-serif UI typography
-   elegant high-contrast heading typography where appropriate

Maintain consistency in:

-   font sizes
-   weights
-   line heights
-   letter spacing
-   hierarchy

Do not use oversized marketing typography inside operational screens.

------------------------------------------------------------------------

# 9. CARD AND SURFACE DESIGN

Cards should follow the screenshot language.

Use:

-   subtle borders
-   soft neutral surfaces
-   restrained shadows
-   rounded corners
-   consistent internal spacing
-   strong hierarchy

Avoid:

-   excessive glassmorphism
-   huge shadows
-   excessive blur
-   floating random cards
-   decorative gradients everywhere

The entire interface should feel like one coherent information system.

------------------------------------------------------------------------

# 10. BRANDING

Brand:

**NIRAMAYA AI**

Tagline:

**INTELLIGENCE FOR A HEALTHIER NATION**

Supporting label:

**PUBLIC HEALTHCARE INTELLIGENCE PLATFORM**

## Logo direction

Do NOT use a generic:

-   hospital cross
-   heartbeat
-   medical plus
-   AI brain
-   robot head
-   generic healthcare icon

Preferred concept:

An abstract geometric **N** formed using connected nodes/lines
representing:

-   N = NIRAMAYA
-   nodes = AI/data
-   connections = healthcare network
-   flow = resource intelligence

The logo should work as:

-   full logo
-   sidebar logo
-   login logo
-   mobile app icon
-   favicon

If an appropriate existing logo exists in the repository, reuse it.

------------------------------------------------------------------------

# 11. GLOBAL APPLICATION SHELL

Create a consistent application shell.

## Desktop

### Left sidebar

Include:

-   NIRAMAYA AI logo
-   Dashboard
-   Facilities
-   Inventory
-   Alerts
-   Predictions
-   Redistribution
-   Equipment
-   AI Assistant
-   Citizen Portal where appropriate

Bottom area:

-   System status
-   User profile
-   Logout

## Top navigation

Include:

-   page title/breadcrumb
-   global search
-   notifications
-   AI/system status
-   user profile

## Mobile/tablet

The reference uses:

**Home \| Supply \| AI Intel \| Profile**

Preserve this navigation concept on smaller screens.

Do not simply shrink the desktop sidebar.

------------------------------------------------------------------------

# 12. LOGIN PAGE

Route:

`/login`

Match the first screenshot's visual language.

## Layout

Desktop:

-   premium navy application background
-   centered/structured login area
-   clean login card
-   strong NIRAMAYA branding

## Branding

-   NIRAMAYA AI logo
-   tagline

## Access role selector

Label:

**SELECT ACCESS ROLE**

Roles:

-   Super Admin
-   State Admin
-   District Admin
-   Hospital
-   Staff
-   Citizen

## Form

**EMAIL OR NATIONAL ID**

**PASSWORD**

Features:

-   show/hide password
-   forgot password
-   remember this device
-   secure/encrypted indicator

Primary CTA:

**SECURE LOGIN**

Optional UI:

**Biometric sign-in**

Do not claim biometric authentication is actually implemented unless
backend/device support exists.

## Footer

-   Ministry of Health & Family Welfare
-   Secure Portal
-   Privacy Policy
-   Help Desk
-   System Status

Include:

-   validation
-   loading
-   error
-   success
-   disabled states

------------------------------------------------------------------------

# 13. ROLE MODEL

Roles:

-   SUPER_ADMIN
-   STATE_ADMIN
-   DISTRICT_ADMIN
-   HOSPITAL_ADMIN
-   FACILITY_STAFF
-   CITIZEN

Role-aware navigation should adapt to the role.

IMPORTANT:

Frontend role checks are for UX only.

Backend authorization is authoritative.

Never treat frontend role checks as security.

------------------------------------------------------------------------

# 14. GOVERNMENT DASHBOARD

Route:

`/dashboard`

This is the main showcase screen.

Use the second screenshot as the primary visual reference.

## Header

**NATIONAL HEALTH COMMAND**

Status:

**Live Telemetry**

Supporting text:

**Updated X minutes ago**

Actions:

-   Filter State
-   Run Diagnostics

## Key metric cards

Create:

1.  TOTAL FACILITIES
2.  CRITICAL ALERTS
3.  PREDICTED SHORTAGES
4.  EXPIRY RISKS
5.  REDISTRIBUTION OPPORTUNITIES
6.  EQUIPMENT ISSUES

Each should show:

-   label
-   primary number
-   trend/status
-   small supporting indicator
-   meaningful icon

Do not make every card visually identical.

------------------------------------------------------------------------

# 15. AI COMMAND INTEL

Create a prominent AI insight panel.

Title:

**NIRAMAYA AI COMMAND INTEL**

Optional confidence badge:

**94.8% Confidence**

Example safe text:

> Critical resource depletion is projected in selected district
> facilities based on current consumption patterns and forecasted
> demand.

Actions:

-   Review Plan
-   Authorize Transfer

IMPORTANT:

These are workflow actions.

Do not actually authorize anything without backend confirmation.

Human approval must remain explicit.

------------------------------------------------------------------------

# 16. HEALTHCARE NETWORK INTELLIGENCE

Create a signature visual section.

Represent:

``` text
State
 ↓
District
 ↓
Facility
 ↓
Resource
```

Visualize:

-   facilities
-   districts
-   states
-   resource flow
-   health status
-   risk
-   connections

Use:

-   connected nodes
-   subtle lines
-   geographic/network-inspired patterns
-   status indicators

This should become one of NIRAMAYA AI's signature visuals.

------------------------------------------------------------------------

# 17. STOCK RISK TREND

Use Recharts.

Show:

-   historical trend
-   current position
-   forecast trend

Filters:

-   7D
-   30D
-   90D

Clearly distinguish:

**Actual**

from

**Forecast**

Never make a forecast visually appear guaranteed.

------------------------------------------------------------------------

# 18. RISK DISTRIBUTION

Create a donut chart.

Categories:

-   Critical Shortage
-   Near Expiry
-   Logistics Delay

Center:

**TOTAL RISKS**

Use meaningful status colors.

Include legend and percentages.

------------------------------------------------------------------------

# 19. CRITICAL ATTENTION FEED

Create an urgent issue feed.

Each item:

-   severity
-   facility
-   resource/equipment
-   issue
-   timestamp
-   status

Actions:

-   Review
-   View Details

------------------------------------------------------------------------

# 20. OPERATIONAL TIMELINE

Create an operational activity timeline.

Example events:

-   prediction generated
-   alert created
-   facility reviewed
-   redistribution recommendation generated
-   recommendation approved
-   inventory updated

Each event:

-   event
-   actor/system
-   timestamp
-   status

------------------------------------------------------------------------

# 21. FACILITIES / NETWORK INTELLIGENCE

Route:

`/facilities`

Use the third screenshot as primary reference.

Header:

**NETWORK INTELLIGENCE**

Subtitle:

**Real-time facility telemetry, resource health, and predictive stock
auditing.**

Action:

**Export Report**

## Filters

-   STATE
-   DISTRICT
-   FACILITY TYPE
-   STATUS

## Tabs

-   Facilities Directory
-   Inventory Intelligence & Expiry

## Summary cards

-   Monitored Facilities
-   Critical Stock Risks
-   Average Supply Health
-   AI Forecast Accuracy

------------------------------------------------------------------------

# 22. FACILITY LIST

Create a polished facility directory/table.

Each facility:

-   facility name
-   location
-   facility type
-   status
-   resource health
-   risk score
-   last updated
-   action

Example demo risk score:

`8.9 / 10`

Clearly mark demo/mock data where appropriate.

Do not imply fictional data is real government data.

------------------------------------------------------------------------

# 23. FACILITY DETAILS

Route:

`/facilities/:id`

Create a complete facility intelligence profile.

Sections:

## Facility Overview

-   name
-   type
-   location
-   status

## Resource Health

-   stock health
-   demand pressure
-   expiry risks

## Predictions

-   shortage risk
-   demand forecast
-   confidence if supplied

## Equipment

-   operational
-   maintenance due
-   issues

## Alerts

-   active
-   resolved

## Recent Activity

Actions:

-   Review
-   Export
-   Create Review Task

------------------------------------------------------------------------

# 24. INVENTORY INTELLIGENCE

Route:

`/inventory`

Show:

-   resource name
-   facility
-   current stock
-   estimated requirement
-   stock health
-   expiry date
-   batch
-   risk level

Filters:

-   facility
-   resource
-   risk
-   expiry
-   status

Search.

Statuses:

-   Healthy
-   Moderate
-   Elevated Risk
-   Critical

Exact inventory information must NEVER be exposed in citizen views.

------------------------------------------------------------------------

# 25. EXPIRY INTELLIGENCE

Include expiry-risk workflows.

Columns:

-   Resource
-   Facility
-   Batch
-   Expiry Date
-   Days Remaining
-   Quantity
-   Risk
-   Action

Urgency groups:

-   30+ days
-   15--30 days
-   \<15 days

Use visual urgency without excessive decoration.

------------------------------------------------------------------------

# 26. ALERT CENTER

Route:

`/alerts`

Create professional alert management.

Severity:

-   Critical
-   High
-   Medium
-   Low

Types:

-   Predicted shortage
-   Expiry risk
-   Equipment issue
-   Logistics delay
-   Resource pressure

Each alert:

-   title
-   facility
-   severity
-   created time
-   status
-   description
-   AI explanation where available

Actions:

-   View
-   Review
-   Mark Reviewed

------------------------------------------------------------------------

# 27. PREDICTIVE INTELLIGENCE

Route:

`/predictions`

Use the fourth screenshot as the visual reference.

Header:

**PREDICTIVE INTELLIGENCE & REDISTRIBUTION**

Supporting label:

**AI NEURAL ENGINE • STATE SYNTHESIS**

Model status:

**Model Active**

Do not invent a model version unless provided by backend.

------------------------------------------------------------------------

# 28. RISK SUMMARY

Create three major panels.

## CRITICAL THRESHOLD

Example:

**3 Districts**

Description:

Demand pressure is approaching or exceeding configured safety
thresholds.

## ELEVATED RISK

Example:

**8 Facilities**

Description:

Resource depletion trajectory is approaching safety buffers.

## STABLE EQUILIBRIUM

Example:

**34 Hubs**

Description:

Supply conditions remain within configured operational ranges.

These are demo values unless real data is provided.

------------------------------------------------------------------------

# 29. HISTORICAL VS FORECASTED DEMAND

Create a large chart.

Show:

-   Actual Demand
-   AI Forecast

Historical period:

Previous weeks

Forecast:

Future weeks

Clearly mark:

**CURRENT**

Then:

**+1 WEEK** **+2 WEEKS**

Use visual differentiation between actual and forecast.

------------------------------------------------------------------------

# 30. AI DECISION SUPPORT SYNTHESIS

Create a premium AI explanation panel.

Title:

**AI DECISION SUPPORT SYNTHESIS**

Example:

> Forecast indicators suggest increased resource pressure across
> selected facilities. Current inventory may approach configured safety
> buffers if demand continues at the projected rate.

Show:

-   Confidence, if supplied
-   Forecast Horizon
-   Estimated Transit

Clearly label this as:

**AI decision support**

Never make AI output appear like an unquestionable government decision.

------------------------------------------------------------------------

# 31. RESOURCE REDISTRIBUTION

Route:

`/recommendations`

Create a dedicated workflow.

Visual:

``` text
SOURCE FACILITY
      ↓
AVAILABLE / EXCESS RESOURCE
      ↓
NIRAMAYA AI RECOMMENDATION
      ↓
DESTINATION FACILITY
      ↓
POTENTIAL RISK REDUCTION
```

Each recommendation:

-   source facility
-   destination facility
-   resource
-   recommended quantity
-   reason
-   estimated transit
-   potential risk reduction
-   confidence if provided

Actions:

-   APPROVE
-   REJECT
-   MODIFY
-   REVIEW

IMPORTANT:

AI does NOT autonomously execute transfers.

Human authorization is required.

After a human action, display an audit event.

------------------------------------------------------------------------

# 32. EQUIPMENT INTELLIGENCE

Route:

`/equipment`

Show:

-   equipment name
-   facility
-   operational status
-   issue
-   maintenance status
-   last maintenance
-   next maintenance
-   risk

Statuses:

-   Operational
-   Maintenance Due
-   Issue Detected
-   Critical

Include:

-   filters
-   search
-   details drawer/modal
-   maintenance timeline

------------------------------------------------------------------------

# 33. NIRAMAYA AI ASSISTANT

Route:

`/ai-assistant`

This must NOT look like a generic ChatGPT clone.

Use the NIRAMAYA **INTELLIGENCE LAYER**.

Visual language:

-   subtle cyan/teal accents
-   network-node patterns
-   thin connecting lines
-   data indicators
-   confidence labels
-   structured responses

Header:

**NIRAMAYA AI**

Subtitle:

**Healthcare Intelligence Assistant**

Suggested prompts:

-   Which facilities currently show elevated shortage risk?
-   Why is this facility marked high risk?
-   Where are potential redistribution opportunities?
-   What resources are approaching expiry?

Response structure can include:

-   summary
-   explanation
-   relevant metrics
-   confidence where provided
-   contextual data
-   related facilities/resources

------------------------------------------------------------------------

# 34. AI ARCHITECTURE

Frontend:

``` text
Frontend
   ↓
Backend
   ↓
Gemini Service
   ↓
Gemini API
```

Gemini API key must NEVER be exposed in frontend code.

The frontend should call a backend endpoint/service abstraction.

Gemini must not:

-   directly access the database
-   directly modify inventory
-   approve actions
-   diagnose
-   prescribe
-   autonomously execute redistribution

------------------------------------------------------------------------

# 35. CITIZEN PORTAL

Route:

`/citizen`

This is a separate public-facing experience.

Citizens may see:

-   public government facilities
-   public services
-   facility location
-   directions
-   public facility information
-   operating information if available

Citizens MUST NOT see:

-   exact internal inventory quantities
-   internal alerts
-   stock-out predictions
-   internal redistribution recommendations
-   procurement information
-   private staff information
-   sensitive operational data

The citizen UI should be simpler and more service-oriented than the
government command center.

------------------------------------------------------------------------

# 36. CITIZEN AI ASSISTANT

Route:

`/citizen/assistant`

Safe public service-navigation assistant.

Suggested questions:

-   Which government facility provides this service?
-   Where is the nearest public facility?
-   What services are available at this facility?
-   How can I find this facility?

Do NOT implement:

-   diagnosis
-   prescription
-   treatment recommendation
-   medical emergency decision-making

This assistant is for **public healthcare service navigation**, not
medical advice.

------------------------------------------------------------------------

# 37. RESPONSIVE DESIGN

Support:

-   desktop
-   laptop
-   tablet
-   mobile

## Desktop

-   sidebar
-   top navigation

## Tablet

-   compact sidebar/navigation

## Mobile

Use a bottom navigation inspired by the reference:

-   Home
-   Supply
-   AI Intel
-   Profile

Do NOT merely shrink the desktop layout.

Actually redesign content for small screens.

Tables should become:

-   responsive cards
-   horizontal scroll where appropriate
-   compact mobile rows

Charts must remain readable.

------------------------------------------------------------------------

# 38. INTERACTIONS

Implement professional micro-interactions:

-   hover states
-   focus states
-   button feedback
-   dropdown transitions
-   tab transitions
-   modal transitions
-   drawer interactions
-   chart tooltips
-   expandable sections
-   toast notifications
-   loading feedback

Animations must be:

-   subtle
-   fast
-   purposeful
-   professional

Do not over-animate.

------------------------------------------------------------------------

# 39. LOADING STATES

Every data-heavy page must have loading states.

Use:

-   skeletons
-   subtle shimmer
-   progress/loading indicators where appropriate

Never leave confusing blank screens.

------------------------------------------------------------------------

# 40. ERROR STATES

Create polished user-facing error states.

Example:

**Unable to load facility intelligence.**

Action:

**Retry**

Never show raw stack traces to users.

------------------------------------------------------------------------

# 41. EMPTY STATES

Examples:

**No critical alerts currently require review.**

**No redistribution recommendations are currently available.**

**No facilities match your filters.**

Provide useful context and actions.

------------------------------------------------------------------------

# 42. MOCK DATA ARCHITECTURE

If backend APIs are not available:

Create realistic **demo/mock data**.

Clearly separate it from API services.

Recommended structure:

``` text
services/
  api/
  mock/
```

Service examples:

-   facilityService
-   inventoryService
-   alertService
-   predictionService
-   recommendationService
-   equipmentService
-   aiService

Components should call service functions.

Do not hard-code data directly inside presentation components.

------------------------------------------------------------------------

# 43. API-READY ARCHITECTURE

Prepare frontend integration points for:

``` text
/api/auth
/api/facilities
/api/inventory
/api/alerts
/api/predictions
/api/recommendations
/api/equipment
/api/ai
```

Do not invent backend implementation.

Only create clean frontend integration contracts/services.

------------------------------------------------------------------------

# 44. ROUTING

Required routes:

``` text
/login
/dashboard
/facilities
/facilities/:id
/inventory
/alerts
/predictions
/recommendations
/equipment
/ai-assistant
/citizen
/citizen/assistant
```

Also implement:

-   protected routes
-   role-aware navigation
-   unauthorized page
-   not found page
-   safe redirects

------------------------------------------------------------------------

# 45. COMPONENT ARCHITECTURE

Create reusable components such as:

## Layout

-   AppLayout
-   Sidebar
-   Topbar
-   MobileNavigation

## Data

-   MetricCard
-   StatusBadge
-   RiskBadge
-   DataTable
-   FacilityCard
-   FacilityTable
-   FilterBar
-   SearchInput

## Charts

-   ChartCard
-   RiskChart
-   ForecastChart
-   DonutChart
-   NetworkVisualization

## Alerts

-   AlertCard
-   AlertFeed
-   Timeline

## AI

-   AIInsightCard
-   AIResponse
-   ConfidenceBadge
-   AIStatusIndicator
-   IntelligenceLayer

## Recommendations

-   RecommendationCard
-   ApprovalDialog
-   AuditTimeline

## UX states

-   LoadingSkeleton
-   EmptyState
-   ErrorState
-   Toast
-   ConfirmationDialog

Avoid huge monolithic components.

------------------------------------------------------------------------

# 46. ACCESSIBILITY

Implement:

-   semantic HTML
-   keyboard navigation
-   accessible labels
-   visible focus states
-   adequate contrast
-   aria labels where necessary
-   screen-reader-friendly structure

Never rely only on color to communicate risk.

------------------------------------------------------------------------

# 47. PERFORMANCE

Optimize for:

-   fast initial load
-   route-level lazy loading where appropriate
-   efficient rendering
-   minimal unnecessary re-renders
-   optimized chart rendering
-   optimized assets

Do not add dependencies without a reason.

------------------------------------------------------------------------

# 48. DATA VISUALIZATION RULES

Charts must communicate information.

Use:

-   line charts
-   area charts
-   donut charts
-   bar charts
-   progress indicators
-   network visualizations

Clearly label:

-   Actual
-   Forecast
-   Current
-   Risk
-   Confidence
-   Estimated

Do not make charts decorative only.

------------------------------------------------------------------------

# 49. DESIGN CONSISTENCY

Every page must feel like the same product.

Maintain:

-   spacing system
-   radius system
-   button system
-   card system
-   typography
-   icon style
-   status colors
-   navigation
-   AI visual identity

Do not let individual pages look like unrelated templates.

------------------------------------------------------------------------

# 50. ICON SYSTEM

Use one consistent professional icon family.

Icons should feel:

-   simple
-   precise
-   healthcare/operations appropriate

Avoid:

-   emoji icons in the application UI
-   cartoon icons
-   inconsistent icon families
-   random decorative icons

------------------------------------------------------------------------

# 51. NO GENERIC DASHBOARD RULE

Do NOT create:

-   generic SaaS dashboard
-   Bootstrap admin template
-   generic CRM
-   generic hospital management template
-   generic ChatGPT clone

The UI must communicate:

**NATIONAL HEALTHCARE RESOURCE INTELLIGENCE**

------------------------------------------------------------------------

# 52. NIRAMAYA INTELLIGENCE LAYER

Create a signature visual language called:

**NIRAMAYA INTELLIGENCE LAYER**

Use especially in:

-   AI Command Intel
-   Predictions
-   Redistribution
-   AI Assistant

Visual elements:

-   subtle cyan/teal accents
-   connected nodes
-   thin data lines
-   forecast markers
-   confidence indicators
-   intelligence labels
-   clean data overlays

Keep it premium and sophisticated.

DO NOT make it cyberpunk.

------------------------------------------------------------------------

# 53. SECURITY AND DATA RULES

Never:

-   expose Gemini API keys
-   expose backend secrets
-   fabricate real government data
-   expose private operational data to citizens
-   claim real-time data without real API support
-   claim confidence without confidence data
-   allow frontend-only authorization to be treated as security

If using demo data, label the environment/data appropriately.

------------------------------------------------------------------------

# 54. CONTENT RULES

Use realistic but clearly fictional/demo data.

Do not imply that fictional hospitals, facilities, statistics, risk
scores, or government records are real.

If using names resembling real institutions, ensure the interface
clearly communicates demo mode.

------------------------------------------------------------------------

# 55. IMPLEMENTATION ORDER

Build in this order:

1.  Inspect repository
2.  Understand existing architecture
3.  Establish design tokens
4.  Establish global layout
5.  Branding/logo
6.  Login
7.  Authentication shell
8.  Routing
9.  Government dashboard
10. Facilities
11. Facility details
12. Inventory
13. Expiry intelligence
14. Alerts
15. Predictions
16. Redistribution
17. Equipment
18. Government AI Assistant
19. Citizen Portal
20. Citizen AI Assistant
21. Responsive optimization
22. Loading states
23. Error states
24. Empty states
25. Accessibility
26. Performance optimization
27. Final visual polish
28. Verification

------------------------------------------------------------------------

# 56. QUALITY BAR

The result should be suitable for:

-   live hackathon demo
-   judges
-   government/healthcare stakeholders
-   technical reviewers
-   portfolio presentation

Prioritize:

1.  Visual quality
2.  Product clarity
3.  Consistency
4.  Interaction quality
5.  Data storytelling
6.  Responsive behavior
7.  Maintainable architecture

------------------------------------------------------------------------

# 57. DO NOT STOP AT SCAFFOLDING

Do not stop after:

-   creating routes
-   creating placeholder pages
-   creating empty components
-   creating basic cards

Actually implement the interface.

Every required page should have:

-   meaningful content
-   realistic demo data
-   polished layout
-   working interactions
-   responsive behavior
-   loading state
-   empty state
-   error state where applicable

------------------------------------------------------------------------

# 58. VERIFICATION

After implementation:

1.  Run TypeScript checks.
2.  Run lint.
3.  Run tests if available.
4.  Run production build.
5.  Fix all errors.
6.  Check every route.
7.  Check all navigation.
8.  Check mobile/tablet/desktop layouts.
9.  Check console errors.
10. Check broken imports.
11. Check missing assets.
12. Check accessibility basics.
13. Verify no secrets are exposed.
14. Verify citizen restrictions.
15. Verify mock/API separation.

Do not claim success unless verification actually passes.

------------------------------------------------------------------------

# 59. FINAL VISUAL REVIEW

Review every page as if you are a hackathon judge.

Ask:

-   Does this look premium?
-   Does this look like a national healthcare intelligence platform?
-   Is the hierarchy clear?
-   Are charts meaningful?
-   Are AI insights visually distinct?
-   Are risks immediately understandable?
-   Is the UI too generic?
-   Is there too much decoration?
-   Is mobile intentionally designed?
-   Is every page consistent?
-   Does the product have a memorable visual identity?

Fix anything that looks unfinished.

------------------------------------------------------------------------

# 60. FINAL REPORT

At the end provide:

1.  What was implemented
2.  All routes
3.  Major reusable components
4.  Design system summary
5.  API integration points
6.  Mock-data areas
7.  Authentication/role handling
8.  AI integration structure
9.  Citizen restrictions
10. Responsive implementation
11. Build status
12. TypeScript status
13. Lint status
14. Test status
15. Remaining limitations, if any

------------------------------------------------------------------------

# FINAL COMMAND

## BUILD THE COMPLETE NIRAMAYA AI FRONTEND NOW.

The uploaded UI screenshots are the **PRIMARY VISUAL REFERENCE**.

Use their design language throughout the application.

Do not build ML models.

Do not build PostgreSQL.

Do not build cloud infrastructure.

Do not expose API secrets.

Do not invent real government data.

Do not stop at scaffolding.

Do not leave required pages as placeholders.

Do not ask unnecessary questions.

Make sensible product/design decisions yourself.

Implement the complete frontend.

Run and verify the application.

Fix issues.

Finish with a polished, coherent, responsive, interactive product that
feels like:

# NIRAMAYA AI

## Intelligence for a Healthier Nation

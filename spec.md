# School Management App — Kindergarten MVP

## Project overview
A responsive, multi-tenant fullstack web application for managing
kindergartens, built with Node.js (Express) backend and React (Vite)
frontend. The app targets kindergartens as the primary market but is
architected to scale to primary and secondary schools in future versions
with minimal structural changes.

## Tech stack
- Frontend: React 18 + Vite, TailwindCSS, React Query, React Router v6,
  Socket.io-client
- Backend: Node.js + Express, Prisma ORM, Zod validation, Socket.io
- Database: PostgreSQL
- Auth: JWT (access + refresh tokens), bcrypt
- File storage: Cloudinary (authenticated uploads, signed URLs with expiry)
- Notifications: Firebase Cloud Messaging (push), Resend (email),
  Twilio (SMS)
- Payments: Chargily Pay (Edahabia + CIB — Algerian market)
- Deployment: Docker-ready, environment-based config

## Design system
See DESIGN.md in the project root. All UI must follow the EduNest design
system defined in that file. Key points:
- Light-first warm UI using Inter Variable font
- Indigo (#4F46E5) primary accent
- Teal (#0D9488) for success/positive states
- Amber (#D97706) for warnings/pending
- Red (#DC2626) for errors/absent/overdue
- shadcn/ui as component base, customised to design tokens
- TailwindCSS for all styling — no inline styles or CSS modules
- Full RTL support for Arabic (dir="rtl" on html element)
- Three portal personalities: Admin (dense), Teacher (efficient),
  Parent (warm, feed-like)

## Locale & currency
- Country: Algeria
- Primary language: Arabic (ar), French (fr)
- Currency: DZD (Algerian Dinar)
- Date format: DD/MM/YYYY
- Payment methods: Edahabia (Algerie Poste), CIB card via Chargily Pay

## Multi-tenancy
Every database table includes a `school_id` foreign key. Tenant isolation
is enforced in a middleware that extracts `school_id` from the verified JWT
on every request. No endpoint trusts `school_id` from the request body.

## User roles (RBAC)
- super_admin: platform-level access across all schools
- admin: full access within their school
- teacher: access to assigned classrooms, children, attendance, messaging
- parent: access to linked children's data, portal, and messaging
- student: inactive in MVP, reserved for future school version

## School types
The `schools` table includes a `school_type` enum:
kindergarten | primary | secondary.
MVP targets kindergarten only. UI feature flags are driven by school_type.

---

## Module 1 — School & user management

### Description
Foundation module. Manages school entities, user accounts, roles, staff
profiles, academic year configuration, classroom allocation, and documents.
Every other module depends on this module being set up first.

### Data models

School:
  id                  uuid PK
  name                string
  school_type         enum (kindergarten | primary | secondary)
  address             string
  wilaya              string
  logo_public_id      string (Cloudinary)
  contact_email       string
  contact_phone       string
  is_active           boolean default true
  created_at          timestamp

User:
  id                  uuid PK
  school_id           uuid FK → School
  first_name          string
  last_name           string
  email               string unique
  password_hash       string
  role                enum (super_admin | admin | teacher | parent | student)
  is_active           boolean default true
  fcm_token           string (Firebase push token)
  preferred_language  enum (ar | fr) default fr
  created_at          timestamp

StaffProfile:
  id                  uuid PK
  user_id             uuid FK → User
  school_id           uuid FK → School
  position            string
  contract_type       enum (full_time | part_time | contract)
  contract_start      date
  contract_end        date nullable
  documents           string[] (Cloudinary public_ids)

AcademicYear:
  id                  uuid PK
  school_id           uuid FK → School
  name                string
  start_date          date
  end_date            date
  is_active           boolean default false

Classroom:
  id                  uuid PK
  school_id           uuid FK → School
  academic_year_id    uuid FK → AcademicYear
  name                string
  capacity            integer
  room_number         string nullable
  level               string (age group for kindergarten, grade for school)
  teacher_user_id     uuid FK → User nullable

### API endpoints
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password

GET    /schools
POST   /schools
GET    /schools/:id
PUT    /schools/:id

GET    /schools/:id/users
POST   /schools/:id/users/invite
PUT    /users/:id
DELETE /users/:id
PUT    /users/:id/fcm-token

GET    /staff
GET    /staff/:id
PUT    /staff/:id

GET    /academic-years
POST   /academic-years
PUT    /academic-years/:id
PUT    /academic-years/:id/activate

GET    /classrooms
POST   /classrooms
GET    /classrooms/:id
PUT    /classrooms/:id
DELETE /classrooms/:id

POST   /documents/upload
GET    /documents/:publicId/url
DELETE /documents/:publicId

### Business rules
- Only super_admin can create schools
- Admin can invite teachers and view all users within their school
- A user belongs to exactly one school
- Only one academic year can be active at a time per school
- Activating an academic year deactivates the previous one
- Staff contract documents stored on Cloudinary (authenticated type)
- Signed URLs for documents expire after 24 hours
- Signed URLs for photos expire after 1 hour
- Invitations sent via email with a one-time token link

---

## Module 2 — Children & classrooms

### Description
Core learner data layer. Every other module references children. Handles
enrollment, classroom grouping, teacher assignment, parent-child linking,
and welfare and medical notes.

### Data models

Child:
  id                  uuid PK
  school_id           uuid FK → School
  academic_year_id    uuid FK → AcademicYear
  first_name          string
  last_name           string
  date_of_birth       date
  gender              enum (male | female)
  photo_public_id     string nullable (Cloudinary)
  enrollment_date     date
  learner_type        enum (child | student) default child
  is_active           boolean default true
  created_at          timestamp

ClassroomEnrollment:
  id                  uuid PK
  child_id            uuid FK → Child
  classroom_id        uuid FK → Classroom
  enrolled_at         timestamp

ParentChildLink:
  id                  uuid PK
  parent_user_id      uuid FK → User
  child_id            uuid FK → Child
  relationship        enum (mother | father | guardian)
  is_primary          boolean default false

EmergencyContact:
  id                  uuid PK
  child_id            uuid FK → Child
  name                string
  relationship        string
  phone               string
  is_authorized_pickup boolean default false

MedicalNote:
  id                  uuid PK
  child_id            uuid FK → Child
  type                enum (allergy | condition | medication)
  description         string
  severity            enum (low | medium | high) nullable
  created_by_user_id  uuid FK → User
  created_at          timestamp

### API endpoints
GET    /children
POST   /children
GET    /children/:id
PUT    /children/:id
DELETE /children/:id

POST   /children/:id/enroll
GET    /children/:id/classroom

GET    /children/:id/parents
POST   /children/:id/parents
DELETE /children/:id/parents/:parentId

GET    /children/:id/emergency-contacts
POST   /children/:id/emergency-contacts
PUT    /emergency-contacts/:id
DELETE /emergency-contacts/:id

GET    /children/:id/medical
POST   /children/:id/medical
PUT    /medical-notes/:id
DELETE /medical-notes/:id

GET    /classrooms/:id/children

### Business rules
- A child can only be enrolled in one classroom per academic year
- A child can be linked to a maximum of 2 parents
- Medical notes visible to teachers and admins only, not parents
- Emergency contacts have is_authorized_pickup flag checked at pickup
- Child photos stored on Cloudinary with 1-hour signed URL expiry
- Deleting a child is a soft delete (is_active = false)

---

## Module 3 — Attendance

### Description
Daily attendance tracking per classroom. Teachers mark each child present,
absent, or late in a single bulk action. Parents receive instant push and
email notifications on absence. Admins view monthly reports.

### Data models

AttendanceRecord:
  id                  uuid PK
  school_id           uuid FK → School
  child_id            uuid FK → Child
  classroom_id        uuid FK → Classroom
  date                date
  status              enum (present | absent | late)
  marked_by_user_id   uuid FK → User
  note                string nullable
  created_at          timestamp

Constraint: unique(child_id, date)

### API endpoints
GET    /attendance?classroom_id=&date=
POST   /attendance/bulk
PUT    /attendance/:id
GET    /attendance/child/:childId?month=&year=
GET    /attendance/classroom/:classroomId/report?month=&year=
GET    /attendance/child/:childId/summary

### Business rules
- One attendance record per child per day (DB constraint)
- Bulk marking is the primary teacher flow
- On absent status: NotificationService fires push + email to linked parents
- Late arrivals can be updated after initial roll call
- Monthly report: total days, present, absent, late, attendance percentage
- Only teachers assigned to classroom and admins can mark attendance

---

## Module 4 — Communication & portal

### Description
Core value proposition for kindergartens. Real-time direct messaging
between teachers and parents, daily child activity reports with photos,
school-wide and classroom announcements, event calendar with consent forms,
multi-channel notifications, and the parent-facing portal.

### Data models

Conversation:
  id                  uuid PK
  school_id           uuid FK → School
  child_id            uuid FK → Child
  teacher_user_id     uuid FK → User
  parent_user_id      uuid FK → User
  created_at          timestamp
  last_message_at     timestamp

Message:
  id                  uuid PK
  conversation_id     uuid FK → Conversation
  sender_user_id      uuid FK → User
  content             string nullable
  message_type        enum (text | photo | document)
  cloudinary_public_id string nullable
  is_read             boolean default false
  created_at          timestamp

DailyReport:
  id                  uuid PK
  school_id           uuid FK → School
  child_id            uuid FK → Child
  classroom_id        uuid FK → Classroom
  date                date
  mood                enum (happy | sad | tired | excited | calm)
  meals_eaten         string
  nap_duration_minutes integer nullable
  activities          string
  general_note        string nullable
  created_by_user_id  uuid FK → User
  created_at          timestamp

DailyReportPhoto:
  id                  uuid PK
  daily_report_id     uuid FK → DailyReport
  cloudinary_public_id string
  created_at          timestamp

Announcement:
  id                  uuid PK
  school_id           uuid FK → School
  classroom_id        uuid FK → Classroom nullable (null = school-wide)
  title               string
  content             string
  created_by_user_id  uuid FK → User
  published_at        timestamp

Event:
  id                  uuid PK
  school_id           uuid FK → School
  title               string
  description         string nullable
  start_datetime      timestamp
  end_datetime        timestamp
  location            string nullable
  requires_consent    boolean default false
  created_by_user_id  uuid FK → User

ConsentForm:
  id                  uuid PK
  event_id            uuid FK → Event
  child_id            uuid FK → Child
  parent_user_id      uuid FK → User
  status              enum (pending | approved | declined)
  responded_at        timestamp nullable

Notification:
  id                  uuid PK
  user_id             uuid FK → User
  school_id           uuid FK → School
  type                string
  title               string
  body                string
  is_read             boolean default false
  reference_id        uuid nullable
  reference_type      string nullable
  created_at          timestamp

### API endpoints
GET    /conversations
POST   /conversations
GET    /conversations/:id/messages
POST   /conversations/:id/messages
PUT    /messages/:id/read
DELETE /messages/:id

GET    /daily-reports?child_id=&date=
POST   /daily-reports
GET    /daily-reports/:id
PUT    /daily-reports/:id
POST   /daily-reports/:id/photos
DELETE /daily-report-photos/:id

GET    /announcements
POST   /announcements
GET    /announcements/:id
DELETE /announcements/:id

GET    /events
POST   /events
GET    /events/:id
PUT    /events/:id
GET    /events/:id/consent
POST   /events/:id/consent
PUT    /consent/:id

GET    /notifications
PUT    /notifications/:id/read
PUT    /notifications/read-all

### Real-time — Socket.io events
Rooms:
  school:{school_id}
  classroom:{classroom_id}
  conversation:{conversation_id}
  user:{user_id}

Events emitted by server:
  message:new         → conversation room
  report:new          → parent user room
  announcement:new    → school or classroom room
  notification:new    → user room

### Notification service
Single NotificationService called by all modules:
  .notify(userId, { title, body, type, referenceId, referenceType })

Channels:
  - FCM push (all mobile notifications)
  - Resend email (absence alerts, invoice reminders, announcements)
  - Twilio SMS (critical only: absence, overdue payment)

All notifications persisted to Notification table regardless of channel.

### Business rules
- Photos in messages and daily reports use Cloudinary authenticated type
- Signed URLs: 1 hour for photos, 24 hours for documents
- Announcements target a classroom or the entire school
- Consent forms created per child per event individually
- A parent can only respond to their own child's consent form
- Only one daily report per child per day
- Teachers can only message parents of children in their classroom

---

## Module 5 — Finance & fees

### Description
Fee structure management, invoice generation, online payment collection
via Chargily Pay (Edahabia + CIB), scholarship and discount tracking,
expense logging, and financial reporting with full audit trail.

### Payment gateway
Provider:  Chargily Pay (https://chargily.com)
Package:   @chargily/chargily-pay
Supports:  Edahabia (Algerie Poste) + CIB card
Currency:  DZD (Algerian Dinar)
Mode:      test (development) | prod (production)

### Data models

FeeStructure:
  id                  uuid PK
  school_id           uuid FK → School
  academic_year_id    uuid FK → AcademicYear
  name                string
  amount              decimal
  currency            string default DZD
  frequency           enum (monthly | quarterly | annual | one_time)
  level               string nullable
  description         string nullable

Invoice:
  id                  uuid PK
  school_id           uuid FK → School
  child_id            uuid FK → Child
  parent_user_id      uuid FK → User
  fee_structure_id    uuid FK → FeeStructure
  amount              decimal
  discount_amount     decimal default 0
  final_amount        decimal
  currency            string default DZD
  due_date            date
  status              enum (draft | sent | paid | overdue | cancelled)
  chargily_checkout_id   string nullable
  chargily_payment_url   string nullable
  issued_at           timestamp nullable
  paid_at             timestamp nullable
  created_at          timestamp

Discount:
  id                  uuid PK
  school_id           uuid FK → School
  child_id            uuid FK → Child
  type                enum (scholarship | sibling | staff | custom)
  percentage          decimal
  description         string nullable
  valid_from          date
  valid_to            date nullable

Expense:
  id                  uuid PK
  school_id           uuid FK → School
  category            string
  description         string
  amount              decimal
  currency            string default DZD
  date                date
  receipt_public_id   string nullable (Cloudinary)
  created_by_user_id  uuid FK → User
  created_at          timestamp

PaymentAuditLog:
  id                  uuid PK
  invoice_id          uuid FK → Invoice
  action              string
  performed_by_user_id uuid FK → User nullable
  previous_status     string
  new_status          string
  metadata            jsonb nullable
  created_at          timestamp

### API endpoints
GET    /fee-structures
POST   /fee-structures
PUT    /fee-structures/:id
DELETE /fee-structures/:id

GET    /invoices
POST   /invoices
GET    /invoices/:id
PUT    /invoices/:id
POST   /invoices/:id/send
POST   /invoices/bulk-generate
GET    /invoices/child/:childId

POST   /payments/create-checkout
POST   /payments/webhook
GET    /payments/success
GET    /payments/failure

GET    /discounts
POST   /discounts
PUT    /discounts/:id
DELETE /discounts/:id

GET    /expenses
POST   /expenses
PUT    /expenses/:id
DELETE /expenses/:id

GET    /finance/report?month=&year=
GET    /finance/summary

### Chargily payment flow
1. Admin generates invoice → status: draft
2. Admin sends invoice → status: sent
   NotificationService alerts parent with payment URL
3. Backend creates Chargily checkout:
   const checkout = await client.createCheckout({
     amount: invoice.final_amount,
     currency: 'dzd',
     success_url: CLIENT_URL/payments/success,
     failure_url: CLIENT_URL/payments/failure,
     webhook_endpoint: API_URL/payments/webhook,
     metadata: { invoice_id: invoice.id },
   });
4. chargily_checkout_id and chargily_payment_url saved on invoice
5. Parent opens payment URL → pays via Edahabia or CIB
6. Chargily POSTs to /payments/webhook
7. Backend verifies webhook signature → invoice status: paid
8. NotificationService confirms payment to parent and admin
9. All status transitions logged to PaymentAuditLog

### Business rules
- Discounts applied automatically at invoice generation
- Bulk invoice generation: one invoice per child in a classroom
- Overdue check: daily cron job moves past-due sent invoices to overdue
- Expense receipts on Cloudinary with 24-hour signed URLs
- All invoice status changes written to PaymentAuditLog
- Only admin can generate, send, and cancel invoices
- Parents view only their own children's invoices

---

## Frontend portals

### Admin portal
- Dashboard: KPIs (enrollment, attendance rate, outstanding invoices,
  unread messages)
- School settings: academic year, classrooms, room allocation
- User management: invite staff, manage parents
- Children list + enrollment form
- Attendance reports
- Finance: fee structures, invoices, expenses, reports
- Announcements composer
- Event & consent management

### Teacher portal
- My classroom: children list, attendance roll call
- Daily report form per child (mood, meals, nap, photos)
- Messaging inbox (conversations with parents)
- Announcements view
- Event calendar

### Parent portal
- My child feed: daily reports, photos, mood timeline
- Messaging: conversations with teacher
- Attendance history
- Invoices and payment (Chargily Pay redirect)
- Consent forms
- Announcements and event calendar
- Notification center

---

## Project structure

### Backend (Node.js + Express)
src/
  config/           database, cloudinary, firebase, twilio, chargily
  middleware/        auth, tenancy, validation, error-handler
  modules/
    auth/
    schools/
    users/
    children/
    classrooms/
    attendance/
    communication/
    finance/
  services/
    NotificationService.ts
    CloudinaryService.ts
    SocketService.ts
  prisma/
    schema.prisma
    migrations/
  utils/
  app.ts
  server.ts

### Frontend (React + Vite)
src/
  api/              React Query hooks per module
  components/       shared UI components (follow DESIGN.md)
  pages/
    auth/
    admin/
    teacher/
    parent/
  layouts/          AdminLayout, TeacherLayout, ParentLayout
  hooks/
  context/          AuthContext, SocketContext
  utils/
  App.tsx
  main.tsx

---

## Environment variables

DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

FIREBASE_SERVICE_ACCOUNT_JSON

RESEND_API_KEY

TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER

CHARGILY_API_KEY
CHARGILY_SECRET

CLIENT_URL
API_URL
PORT=5000

---

## Build order

Step 1 — Foundation
  Prisma schema for all 5 modules
  Database migrations
  JWT auth (register, login, refresh, logout)
  RBAC middleware
  Multi-tenancy middleware (school_id injection)

Step 2 — Core data
  School CRUD
  Academic year + classroom management
  User invite flow
  Children enrollment
  Parent-child linking
  Classroom enrollment

Step 3 — Daily operations
  Attendance bulk marking
  Absence notification via NotificationService
  Attendance reports

Step 4 — Communication
  Socket.io setup (rooms, connection handling)
  Conversation + messaging (real-time)
  Daily report form + photo upload (Cloudinary)
  Announcements
  Event calendar + consent forms
  FCM push + Resend email notifications

Step 5 — Finance
  Fee structure setup
  Invoice generation + bulk generate
  Chargily Pay checkout + webhook
  Discount application
  Expense tracking
  Overdue cron job
  Financial reports

Step 6 — Polish
  Parent portal UI (warm feed layout per DESIGN.md)
  Teacher portal UI (task-efficient layout per DESIGN.md)
  Admin dashboard with KPIs (dense layout per DESIGN.md)
  PWA manifest + service worker
  RTL layout support (Arabic)
  Error handling + logging
  Docker + deployment config

---

## Future school expansion (v2 — do not build now)
  - Gradebook and report cards
  - Multi-subject timetable builder
  - Homework and assignment tracker
  - Exam scheduling and results
  - Student self-service portal
  - Library module
  - Transport and GPS tracking
  - Analytics and BI dashboard
  - Third-party API integrations

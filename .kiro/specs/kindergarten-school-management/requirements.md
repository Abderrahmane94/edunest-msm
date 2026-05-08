# Requirements Document

## Introduction

EduNest is a responsive, multi-tenant fullstack web application for managing kindergartens. Built with Node.js (Express) backend and React (Vite) frontend, the system targets kindergartens as the primary market but is architected to scale to primary and secondary schools in future versions. The application serves the Algerian market with Arabic (RTL) and French (LTR) language support, DZD currency, and local payment integration via Chargily Pay.

The system comprises five core modules: School & User Management, Children & Classrooms, Attendance, Communication & Portal, and Finance & Fees. Three distinct portal experiences serve administrators (data-dense), teachers (task-focused), and parents (warm, feed-like).

## Glossary

- **System**: The EduNest kindergarten school management application as a whole
- **Auth_Service**: The authentication subsystem handling JWT-based login, registration, token refresh, and password reset
- **Tenancy_Middleware**: The middleware layer that extracts and enforces school_id from verified JWT on every request
- **RBAC_Middleware**: The role-based access control middleware that restricts endpoint access based on user roles
- **School_Service**: The subsystem managing school entity CRUD operations
- **User_Service**: The subsystem managing user accounts, invitations, and role assignments
- **Staff_Service**: The subsystem managing staff profiles, contracts, and documents
- **AcademicYear_Service**: The subsystem managing academic year configuration and activation
- **Classroom_Service**: The subsystem managing classroom creation, capacity, and teacher assignment
- **Child_Service**: The subsystem managing child records, enrollment, and parent-child linking
- **Attendance_Service**: The subsystem managing daily attendance marking, updates, and reporting
- **Communication_Service**: The subsystem managing real-time messaging, daily reports, announcements, events, and consent forms
- **Notification_Service**: The centralized notification dispatcher handling FCM push, Resend email, and Twilio SMS channels
- **Finance_Service**: The subsystem managing fee structures, invoices, payments, discounts, and expenses
- **Chargily_Gateway**: The Chargily Pay payment gateway integration supporting Edahabia and CIB payment methods
- **Cloudinary_Service**: The file storage subsystem handling authenticated uploads and signed URL generation
- **Socket_Service**: The real-time communication layer using Socket.io for live messaging and notifications
- **Admin_Portal**: The web interface for school administrators with dense, data-rich layouts
- **Teacher_Portal**: The web interface for teachers with task-focused, efficient workflows
- **Parent_Portal**: The web interface for parents with warm, feed-like, mobile-first design
- **School**: A kindergarten entity registered on the platform
- **Academic_Year**: A defined school year period with start and end dates
- **Classroom**: A physical or logical grouping of children within an academic year
- **Child**: A learner enrolled in a kindergarten
- **Invoice**: A financial document representing fees owed by a parent for a child
- **Daily_Report**: A teacher-created summary of a child's day including mood, meals, nap, and activities
- **Conversation**: A messaging thread between a teacher and a parent about a specific child
- **Announcement**: A school-wide or classroom-specific notice published by an admin or teacher
- **Event**: A scheduled school activity that may require parental consent
- **Consent_Form**: A per-child consent record for an event requiring parental approval
- **Fee_Structure**: A defined fee template with amount, frequency, and applicable level
- **Discount**: A reduction applied to a child's invoice based on scholarship, sibling, staff, or custom criteria
- **DZD**: Algerian Dinar, the currency used for all financial transactions
- **FCM**: Firebase Cloud Messaging, used for push notifications
- **JWT**: JSON Web Token, used for stateless authentication with access and refresh token pairs
- **RTL**: Right-to-left text direction, used for Arabic language support

## Requirements

### Requirement 1: Multi-Tenant Data Isolation

**User Story:** As a school administrator, I want all data to be isolated per school, so that no school can access another school's information.

#### Acceptance Criteria

1. THE Tenancy_Middleware SHALL include a school_id foreign key on every database table
2. WHEN a request is received, THE Tenancy_Middleware SHALL extract school_id from the verified JWT claims
3. THE Tenancy_Middleware SHALL filter all database queries by the authenticated school_id
4. THE System SHALL reject any request body that attempts to override school_id with a value different from the JWT-derived school_id
5. IF a user attempts to access a resource belonging to a different school, THEN THE System SHALL return a 403 Forbidden response

### Requirement 2: JWT Authentication

**User Story:** As a user, I want to securely authenticate with the system, so that my account and data are protected.

#### Acceptance Criteria

1. WHEN a user submits valid credentials to the login endpoint, THE Auth_Service SHALL return an access token (15-minute expiry) and a refresh token (7-day expiry)
2. WHEN a user submits an expired access token with a valid refresh token, THE Auth_Service SHALL issue a new access token without requiring re-authentication
3. WHEN a user submits an invalid or expired refresh token, THE Auth_Service SHALL return a 401 Unauthorized response
4. THE Auth_Service SHALL hash all passwords using bcrypt before storage
5. WHEN a user requests a password reset, THE Auth_Service SHALL send a one-time token link via email that expires after 1 hour
6. WHEN a user logs out, THE Auth_Service SHALL invalidate the refresh token

### Requirement 3: Role-Based Access Control

**User Story:** As a platform operator, I want to enforce role-based permissions, so that users can only access features appropriate to their role.

#### Acceptance Criteria

1. THE RBAC_Middleware SHALL support five roles: super_admin, admin, teacher, parent, and student (inactive in MVP)
2. THE RBAC_Middleware SHALL restrict super_admin endpoints to users with the super_admin role only
3. THE RBAC_Middleware SHALL restrict school administration endpoints to users with the admin role within their school
4. THE RBAC_Middleware SHALL restrict classroom operations to teachers assigned to the specific classroom and admins
5. THE RBAC_Middleware SHALL restrict parent endpoints to viewing only data linked to their own children
6. IF an unauthorized user attempts to access a restricted endpoint, THEN THE RBAC_Middleware SHALL return a 403 Forbidden response with a descriptive error message

### Requirement 4: School Management

**User Story:** As a super_admin, I want to create and manage school entities, so that new kindergartens can be onboarded to the platform.

#### Acceptance Criteria

1. WHEN a super_admin submits a valid school creation request, THE School_Service SHALL create a new school record with name, school_type, address, wilaya, contact_email, and contact_phone
2. THE School_Service SHALL support school_type values of kindergarten, primary, and secondary
3. WHEN an admin updates school details, THE School_Service SHALL persist the changes and return the updated school record
4. THE School_Service SHALL store school logos on Cloudinary and reference them by public_id
5. THE School_Service SHALL allow super_admin to deactivate a school by setting is_active to false

### Requirement 5: User Invitation and Management

**User Story:** As a school admin, I want to invite teachers and parents to the platform, so that they can access the system with appropriate roles.

#### Acceptance Criteria

1. WHEN an admin submits a user invitation, THE User_Service SHALL send an email containing a one-time invitation token link
2. WHEN an invited user clicks the invitation link, THE User_Service SHALL present a registration form pre-filled with their email and assigned role
3. THE User_Service SHALL enforce that each user belongs to exactly one school
4. WHEN an admin updates a user's active status, THE User_Service SHALL immediately revoke access for deactivated users
5. THE User_Service SHALL allow users to update their FCM token for push notification delivery
6. THE User_Service SHALL allow users to set their preferred_language to either Arabic (ar) or French (fr)

### Requirement 6: Staff Profile Management

**User Story:** As a school admin, I want to manage staff profiles with contract details and documents, so that I can maintain employment records.

#### Acceptance Criteria

1. WHEN an admin creates a staff profile, THE Staff_Service SHALL associate the profile with a user record and store position, contract_type, contract_start, and optional contract_end
2. THE Staff_Service SHALL support contract_type values of full_time, part_time, and contract
3. WHEN a staff document is uploaded, THE Cloudinary_Service SHALL store the file with authenticated access type
4. WHEN a user requests a staff document, THE Cloudinary_Service SHALL generate a signed URL with 24-hour expiry
5. IF a signed document URL has expired, THEN THE Cloudinary_Service SHALL reject the request and require a new URL generation

### Requirement 7: Academic Year Configuration

**User Story:** As a school admin, I want to configure academic years, so that I can organize school operations by time periods.

#### Acceptance Criteria

1. WHEN an admin creates an academic year, THE AcademicYear_Service SHALL store the name, start_date, and end_date for the school
2. THE AcademicYear_Service SHALL enforce that only one academic year is active at a time per school
3. WHEN an admin activates an academic year, THE AcademicYear_Service SHALL deactivate the previously active academic year for that school
4. THE AcademicYear_Service SHALL associate classrooms and child enrollments with the active academic year

### Requirement 8: Classroom Management

**User Story:** As a school admin, I want to create and manage classrooms, so that children can be organized into groups with assigned teachers.

#### Acceptance Criteria

1. WHEN an admin creates a classroom, THE Classroom_Service SHALL store the name, capacity, room_number, level (age group), and academic_year_id
2. THE Classroom_Service SHALL allow assigning one teacher to a classroom via teacher_user_id
3. WHEN an admin updates a classroom, THE Classroom_Service SHALL validate that the assigned teacher belongs to the same school
4. THE Classroom_Service SHALL allow deletion of a classroom only when no children are currently enrolled
5. THE Classroom_Service SHALL enforce that classroom capacity is a positive integer

### Requirement 9: Child Registration and Enrollment

**User Story:** As a school admin, I want to register children and enroll them in classrooms, so that learner records are maintained and organized.

#### Acceptance Criteria

1. WHEN an admin registers a child, THE Child_Service SHALL store first_name, last_name, date_of_birth, gender, enrollment_date, and associate the child with the school and active academic year
2. THE Child_Service SHALL enforce that a child can only be enrolled in one classroom per academic year
3. WHEN a child is enrolled in a classroom, THE Child_Service SHALL create a ClassroomEnrollment record with the enrollment timestamp
4. WHEN a child photo is uploaded, THE Cloudinary_Service SHALL store the photo and generate signed URLs with 1-hour expiry
5. WHEN an admin deletes a child, THE Child_Service SHALL perform a soft delete by setting is_active to false
6. THE Child_Service SHALL default learner_type to "child" for kindergarten enrollments

### Requirement 10: Parent-Child Linking

**User Story:** As a school admin, I want to link parents to their children, so that parents can access their child's information through the portal.

#### Acceptance Criteria

1. WHEN an admin links a parent to a child, THE Child_Service SHALL create a ParentChildLink record with the relationship type (mother, father, or guardian)
2. THE Child_Service SHALL enforce a maximum of 2 parent links per child
3. THE Child_Service SHALL allow designating one parent link as is_primary
4. WHEN a parent is linked to a child, THE Parent_Portal SHALL display that child's data in the parent's feed

### Requirement 11: Emergency Contacts

**User Story:** As a school admin, I want to record emergency contacts for each child, so that authorized persons can be contacted or pick up children.

#### Acceptance Criteria

1. WHEN an admin adds an emergency contact, THE Child_Service SHALL store the contact name, relationship, phone number, and is_authorized_pickup flag
2. THE Child_Service SHALL allow multiple emergency contacts per child
3. THE Child_Service SHALL display the is_authorized_pickup flag prominently for pickup verification

### Requirement 13: Bulk Attendance Marking

**User Story:** As a teacher, I want to mark attendance for all children in my classroom at once, so that I can efficiently complete the daily roll call.

#### Acceptance Criteria

1. WHEN a teacher submits a bulk attendance request, THE Attendance_Service SHALL create one AttendanceRecord per child in the classroom for the specified date
2. THE Attendance_Service SHALL support status values of present, absent, and late
3. THE Attendance_Service SHALL enforce a unique constraint on child_id and date, allowing only one record per child per day
4. WHEN a teacher updates an attendance record, THE Attendance_Service SHALL allow changing status (for example, marking a late arrival after initial roll call)
5. THE Attendance_Service SHALL restrict attendance marking to teachers assigned to the classroom and school admins
6. THE Attendance_Service SHALL store an optional note with each attendance record

### Requirement 14: Absence Notifications

**User Story:** As a parent, I want to be notified immediately when my child is marked absent, so that I am aware of my child's attendance status.

#### Acceptance Criteria

1. WHEN a child is marked absent, THE Notification_Service SHALL send a push notification via FCM to all linked parents
2. WHEN a child is marked absent, THE Notification_Service SHALL send an email notification via Resend to all linked parents
3. WHEN a child is marked absent, THE Notification_Service SHALL send an SMS notification via Twilio to the primary parent
4. THE Notification_Service SHALL persist all absence notifications to the Notification table with type, title, body, and reference to the attendance record

### Requirement 15: Attendance Reporting

**User Story:** As a school admin, I want to view monthly attendance reports, so that I can monitor attendance patterns across classrooms.

#### Acceptance Criteria

1. WHEN an admin requests a classroom attendance report for a given month, THE Attendance_Service SHALL return total days, present count, absent count, late count, and attendance percentage per child
2. WHEN a parent requests their child's attendance summary, THE Attendance_Service SHALL return the child's monthly attendance breakdown
3. THE Attendance_Service SHALL calculate attendance percentage as (present + late) divided by total school days in the period, multiplied by 100

### Requirement 16: Real-Time Messaging

**User Story:** As a teacher or parent, I want to exchange real-time messages, so that we can communicate about a child's progress and needs.

#### Acceptance Criteria

1. WHEN a teacher or parent sends a message, THE Communication_Service SHALL deliver the message in real-time via Socket.io to the conversation room
2. THE Communication_Service SHALL support message types of text, photo, and document
3. WHEN a photo or document message is sent, THE Cloudinary_Service SHALL store the file with authenticated access and generate signed URLs (1 hour for photos, 24 hours for documents)
4. THE Communication_Service SHALL create conversations scoped to a specific child, linking one teacher and one parent
5. THE Communication_Service SHALL restrict teachers to messaging only parents of children in their assigned classroom
6. WHEN a recipient reads a message, THE Communication_Service SHALL update the is_read flag and emit a read receipt event via Socket.io
7. THE Socket_Service SHALL emit a "message:new" event to the conversation room when a new message is created

### Requirement 17: Daily Reports

**User Story:** As a teacher, I want to create daily activity reports for each child, so that parents can see how their child's day went.

#### Acceptance Criteria

1. WHEN a teacher creates a daily report, THE Communication_Service SHALL store the child_id, date, mood, meals_eaten, nap_duration_minutes, activities, and optional general_note
2. THE Communication_Service SHALL support mood values of happy, sad, tired, excited, and calm
3. THE Communication_Service SHALL enforce only one daily report per child per day
4. WHEN a teacher uploads photos to a daily report, THE Cloudinary_Service SHALL store photos with authenticated access and 1-hour signed URL expiry
5. WHEN a daily report is created, THE Socket_Service SHALL emit a "report:new" event to the parent's user room
6. THE Parent_Portal SHALL display daily reports in a feed-like layout with mood color indicators and photo grids

### Requirement 18: Announcements

**User Story:** As a school admin, I want to publish announcements to the entire school or specific classrooms, so that important information reaches the right audience.

#### Acceptance Criteria

1. WHEN an admin creates an announcement with a classroom_id, THE Communication_Service SHALL target the announcement to that classroom only
2. WHEN an admin creates an announcement without a classroom_id, THE Communication_Service SHALL target the announcement to the entire school
3. WHEN an announcement is published, THE Socket_Service SHALL emit an "announcement:new" event to the appropriate school or classroom room
4. WHEN an announcement is published, THE Notification_Service SHALL send push notifications to all targeted users
5. THE Communication_Service SHALL store the published_at timestamp and the creating user

### Requirement 19: Events and Consent Forms

**User Story:** As a school admin, I want to create events and collect parental consent, so that I can organize activities requiring parent approval.

#### Acceptance Criteria

1. WHEN an admin creates an event with requires_consent set to true, THE Communication_Service SHALL generate individual ConsentForm records for each child in the school
2. THE Communication_Service SHALL support consent status values of pending, approved, and declined
3. THE Communication_Service SHALL restrict parents to responding only to consent forms for their own linked children
4. WHEN a parent responds to a consent form, THE Communication_Service SHALL record the responded_at timestamp and updated status
5. THE Communication_Service SHALL store event details including title, description, start_datetime, end_datetime, and optional location

### Requirement 20: Notification Service

**User Story:** As a user, I want to receive notifications through multiple channels, so that I stay informed about important events regardless of my current device.

#### Acceptance Criteria

1. THE Notification_Service SHALL support three delivery channels: FCM push, Resend email, and Twilio SMS
2. WHEN the Notification_Service dispatches a notification, THE Notification_Service SHALL persist the notification to the Notification table with user_id, type, title, body, reference_id, and reference_type
3. THE Notification_Service SHALL use Twilio SMS only for critical notifications: absence alerts and overdue payment reminders
4. THE Notification_Service SHALL deliver notifications in the user's preferred_language (Arabic or French)
5. WHEN a user marks a notification as read, THE Notification_Service SHALL update the is_read flag
6. THE Notification_Service SHALL support marking all notifications as read in a single operation
7. THE Socket_Service SHALL emit a "notification:new" event to the user's personal room for real-time notification delivery

### Requirement 21: Fee Structure Management

**User Story:** As a school admin, I want to define fee structures, so that I can standardize tuition and service charges across the school.

#### Acceptance Criteria

1. WHEN an admin creates a fee structure, THE Finance_Service SHALL store the name, amount, currency (DZD), frequency, optional level, and description
2. THE Finance_Service SHALL support frequency values of monthly, quarterly, annual, and one_time
3. THE Finance_Service SHALL associate fee structures with a specific academic year
4. THE Finance_Service SHALL allow updating and deleting fee structures that have no associated invoices

### Requirement 22: Invoice Generation

**User Story:** As a school admin, I want to generate invoices for children, so that parents can be billed for school fees.

#### Acceptance Criteria

1. WHEN an admin generates an invoice, THE Finance_Service SHALL create an invoice record with child_id, parent_user_id, fee_structure_id, amount, due_date, and status set to "draft"
2. THE Finance_Service SHALL automatically apply applicable discounts and calculate final_amount as amount minus discount_amount
3. WHEN an admin triggers bulk invoice generation for a classroom, THE Finance_Service SHALL create one invoice per enrolled child in that classroom
4. THE Finance_Service SHALL support invoice status values of draft, sent, paid, overdue, and cancelled
5. WHEN an admin sends an invoice, THE Finance_Service SHALL update status to "sent" and THE Notification_Service SHALL alert the parent with the payment URL
6. THE Finance_Service SHALL restrict invoice generation, sending, and cancellation to admin users only

### Requirement 23: Chargily Pay Integration

**User Story:** As a parent, I want to pay invoices online using Edahabia or CIB, so that I can conveniently settle school fees.

#### Acceptance Criteria

1. WHEN an admin sends an invoice, THE Chargily_Gateway SHALL create a checkout session with the invoice final_amount in DZD, success_url, failure_url, and webhook_endpoint
2. THE Finance_Service SHALL store the chargily_checkout_id and chargily_payment_url on the invoice record
3. WHEN a parent completes payment, THE Chargily_Gateway SHALL POST to the webhook endpoint with payment confirmation
4. WHEN the webhook is received, THE Finance_Service SHALL verify the webhook signature before processing
5. WHEN payment is confirmed, THE Finance_Service SHALL update the invoice status to "paid" and record paid_at timestamp
6. WHEN payment is confirmed, THE Notification_Service SHALL send payment confirmation to both the parent and admin
7. THE Chargily_Gateway SHALL support both Edahabia (Algerie Poste) and CIB card payment methods

### Requirement 23.1: Cash Payment Management

**User Story:** As a parent, I want to pay school invoices in cash, so that
I can settle fees without needing a bank card or online payment method.
As an admin, I want to record, track, and manage cash payments, so that
the school's financial records remain accurate and complete.

#### Acceptance Criteria

1. WHEN an admin opens an invoice, THE Finance_Service SHALL display a
   "Record cash payment" action alongside the existing online payment option

2. WHEN an admin records a cash payment, THE Finance_Service SHALL require
   the following fields: amount_received (decimal, DZD), received_by
   (admin user_id), received_at (datetime), and an optional note

3. WHEN amount_received equals invoice final_amount, THE Finance_Service
   SHALL update the invoice status to "paid" and record paid_at timestamp

4. WHEN amount_received is less than invoice final_amount, THE Finance_Service
   SHALL update the invoice status to "partial" and record the outstanding
   balance as remaining_amount on the invoice record

5. WHEN a partial cash payment is recorded, THE Finance_Service SHALL allow
   subsequent cash payment recordings against the same invoice until the
   remaining_amount reaches zero

6. WHEN remaining_amount reaches zero, THE Finance_Service SHALL automatically
   update the invoice status to "paid" and record the final paid_at timestamp

7. THE Finance_Service SHALL create a CashPayment record for every cash
   transaction containing: id, invoice_id, school_id, amount, received_by,
   received_at, note, and created_at

8. THE Finance_Service SHALL append a PaymentAuditLog entry for every cash
   payment recording, capturing previous_status, new_status, performed_by_
   user_id, and a metadata field containing amount_received and note

9. WHEN a cash payment is recorded, THE Notification_Service SHALL send a
   payment confirmation to the parent via push and email, including the
   amount received, remaining balance if partial, and the name of the admin
   who recorded it

10. WHEN a cash payment is recorded, THE Notification_Service SHALL send an
    internal confirmation to the admin who recorded the payment as an audit
    acknowledgement

11. THE Finance_Service SHALL generate a printable cash receipt in PDF format
    containing: school name and logo, child name, invoice reference, amount
    received, payment date, received by (staff name), remaining balance if
    partial, and a unique receipt number

12. WHEN an admin views the invoice list, THE Finance_Service SHALL display
    payment method badges distinguishing "Online" (Chargily) from "Cash"
    payments per invoice

13. WHEN an admin views the finance report, THE Finance_Service SHALL
    include a payment method breakdown showing total collected via cash
    versus total collected via Chargily Pay for the selected period

14. THE Finance_Service SHALL expose the following endpoints for cash
    payment management:
    POST   /invoices/:id/cash-payment       (record a cash payment)
    GET    /invoices/:id/cash-payments       (list all cash payments on invoice)
    GET    /cash-payments/:id/receipt        (download PDF receipt)
    GET    /finance/report/payment-methods   (cash vs online breakdown)

15. WHEN a parent views their invoice in the parent portal, THE Finance_Service
    SHALL display the full payment history including all cash payment
    transactions with date, amount, and receipt download option

16. WHEN an admin attempts to record a cash payment on an invoice with status
    "cancelled" or "paid", THE Finance_Service SHALL reject the request with
    a 400 error and an appropriate message

17. THE Finance_Service SHALL ensure only users with role "admin" can record,
    view, and manage cash payments — parents have read-only access to their
    own payment history

### Requirement 24: Discount Management

**User Story:** As a school admin, I want to apply discounts to children's fees, so that scholarships and sibling discounts are reflected in invoices.

#### Acceptance Criteria

1. WHEN an admin creates a discount, THE Finance_Service SHALL store the child_id, type (scholarship, sibling, staff, or custom), percentage, description, valid_from, and optional valid_to
2. WHEN an invoice is generated, THE Finance_Service SHALL automatically apply all active discounts for the child and calculate the discount_amount
3. THE Finance_Service SHALL validate that discount percentage is between 0 and 100
4. THE Finance_Service SHALL only apply discounts where the current date falls within the valid_from and valid_to range

### Requirement 25: Expense Tracking

**User Story:** As a school admin, I want to record school expenses, so that I can track operational costs and generate financial reports.

#### Acceptance Criteria

1. WHEN an admin creates an expense, THE Finance_Service SHALL store the category, description, amount in DZD, date, and creating user
2. WHEN an expense receipt is uploaded, THE Cloudinary_Service SHALL store the receipt with authenticated access and 24-hour signed URL expiry
3. THE Finance_Service SHALL allow updating and deleting expense records by admin users

### Requirement 26: Overdue Invoice Processing

**User Story:** As a school admin, I want overdue invoices to be automatically flagged, so that I can follow up on unpaid fees.

#### Acceptance Criteria

1. THE Finance_Service SHALL run a daily scheduled job that identifies sent invoices with due_date before the current date
2. WHEN a sent invoice is past due, THE Finance_Service SHALL update the invoice status to "overdue"
3. WHEN an invoice becomes overdue, THE Notification_Service SHALL send an SMS reminder to the parent via Twilio
4. WHEN an invoice becomes overdue, THE Notification_Service SHALL send an email reminder to the parent via Resend

### Requirement 27: Payment Audit Trail

**User Story:** As a school admin, I want all invoice status changes to be logged, so that I have a complete audit trail for financial accountability.

#### Acceptance Criteria

1. WHEN an invoice status changes, THE Finance_Service SHALL create a PaymentAuditLog entry with invoice_id, action, performing user, previous_status, new_status, and optional metadata
2. THE Finance_Service SHALL log all status transitions including draft→sent, sent→paid, sent→overdue, and any→cancelled
3. THE Finance_Service SHALL store webhook-triggered status changes with the Chargily metadata in the audit log

### Requirement 28: Financial Reporting

**User Story:** As a school admin, I want to view financial reports, so that I can understand revenue, expenses, and outstanding balances.

#### Acceptance Criteria

1. WHEN an admin requests a monthly financial report, THE Finance_Service SHALL return total invoiced amount, total collected amount, total outstanding amount, and total expenses for the specified period
2. WHEN an admin requests a financial summary, THE Finance_Service SHALL return overall revenue, collection rate, and expense breakdown by category
3. THE Finance_Service SHALL restrict financial report access to admin users only

### Requirement 29: Bilingual Support (Arabic and French)

**User Story:** As a user, I want to use the application in Arabic or French, so that I can interact with the system in my preferred language.

#### Acceptance Criteria

1. THE System SHALL support Arabic (ar) and French (fr) as interface languages
2. WHEN a user sets preferred_language to Arabic, THE System SHALL render the interface in RTL (right-to-left) direction
3. WHEN a user sets preferred_language to French, THE System SHALL render the interface in LTR (left-to-right) direction
4. THE System SHALL deliver all notifications, emails, and SMS messages in the recipient's preferred_language
5. THE System SHALL use the DZD (Algerian Dinar) currency format for all financial displays
6. THE System SHALL format dates in DD/MM/YYYY format

### Requirement 30: Admin Portal

**User Story:** As a school admin, I want a data-dense dashboard and management interface, so that I can efficiently oversee all school operations.

#### Acceptance Criteria

1. THE Admin_Portal SHALL display a dashboard with KPI cards showing enrollment count, attendance rate, outstanding invoices, and unread messages
2. THE Admin_Portal SHALL provide data tables with sortable columns, pagination, and search for all entity lists
3. THE Admin_Portal SHALL use a fixed sidebar navigation on desktop viewports (1024px and above)
4. THE Admin_Portal SHALL collapse the sidebar to a bottom tab bar on mobile viewports (below 1024px)
5. THE Admin_Portal SHALL follow the EduNest design system with dense, information-rich layouts

### Requirement 31: Teacher Portal

**User Story:** As a teacher, I want a task-focused interface, so that I can efficiently complete daily classroom operations.

#### Acceptance Criteria

1. THE Teacher_Portal SHALL provide a full-screen focused attendance roll call view without distractions
2. THE Teacher_Portal SHALL provide a daily report form with large tap targets (minimum 48px) for mobile use
3. THE Teacher_Portal SHALL display a messaging inbox with a 2-column layout: conversation list and active chat
4. THE Teacher_Portal SHALL provide prominent quick-action buttons for common tasks (mark all present, send report)
5. THE Teacher_Portal SHALL follow the EduNest design system with task-efficient layouts

### Requirement 32: Parent Portal

**User Story:** As a parent, I want a warm, mobile-first interface, so that I can easily view my child's daily activities and communicate with teachers.

#### Acceptance Criteria

1. THE Parent_Portal SHALL display daily reports as the primary feed component with mood color indicators and photo grids
2. THE Parent_Portal SHALL use a single-column feed layout optimized for mobile devices (max-width 600px centered)
3. THE Parent_Portal SHALL display the child's photo prominently in the header
4. THE Parent_Portal SHALL provide access to messaging, attendance history, invoices, consent forms, announcements, and notifications
5. THE Parent_Portal SHALL use amber (not red) for invoice notifications to maintain a non-alarming tone
6. THE Parent_Portal SHALL follow the EduNest design system with warm, emotionally reassuring layouts

### Requirement 33: Real-Time Socket Communication

**User Story:** As a user, I want real-time updates without refreshing the page, so that I receive messages and notifications instantly.

#### Acceptance Criteria

1. THE Socket_Service SHALL organize connections into rooms: school:{school_id}, classroom:{classroom_id}, conversation:{conversation_id}, and user:{user_id}
2. THE Socket_Service SHALL emit "message:new" events to conversation rooms when new messages are created
3. THE Socket_Service SHALL emit "report:new" events to parent user rooms when daily reports are created
4. THE Socket_Service SHALL emit "announcement:new" events to school or classroom rooms when announcements are published
5. THE Socket_Service SHALL emit "notification:new" events to user rooms for all notification types
6. THE Socket_Service SHALL authenticate socket connections using the JWT access token

### Requirement 34: File Storage and Signed URLs

**User Story:** As a user, I want secure access to uploaded files, so that documents and photos are protected with time-limited access.

#### Acceptance Criteria

1. THE Cloudinary_Service SHALL store all uploads with authenticated access type
2. WHEN a photo URL is requested, THE Cloudinary_Service SHALL generate a signed URL with 1-hour expiry
3. WHEN a document URL is requested, THE Cloudinary_Service SHALL generate a signed URL with 24-hour expiry
4. IF a signed URL has expired, THEN THE System SHALL require the user to request a new signed URL
5. THE Cloudinary_Service SHALL support photo uploads for child profiles, daily reports, and chat messages
6. THE Cloudinary_Service SHALL support document uploads for staff contracts and expense receipts

### Requirement 35: Input Validation

**User Story:** As a developer, I want all API inputs to be validated, so that the system rejects malformed requests before processing.

#### Acceptance Criteria

1. THE System SHALL validate all incoming request bodies using Zod schemas
2. IF a request body fails validation, THEN THE System SHALL return a 400 Bad Request response with descriptive field-level error messages
3. THE System SHALL validate all UUID parameters for correct format
4. THE System SHALL validate all date parameters for correct DD/MM/YYYY format
5. THE System SHALL validate email addresses for correct format on user creation and invitation

### Requirement 36: Responsive Design

**User Story:** As a user, I want the application to work on all device sizes, so that I can access it from desktop, tablet, or mobile.

#### Acceptance Criteria

1. THE System SHALL support responsive breakpoints at 640px (mobile), 768px (tablet), 1024px (desktop), and 1280px (wide desktop)
2. WHILE the viewport is below 1024px, THE Admin_Portal and Teacher_Portal SHALL display a bottom tab bar instead of a sidebar
3. THE Parent_Portal SHALL be mobile-first with a single-column layout that scales up for larger viewports
4. WHILE the viewport is below 768px, THE System SHALL display tables with horizontal scrolling and a sticky first column
5. THE System SHALL ensure all interactive elements have a minimum touch target of 44px on mobile viewports

### Requirement 37: Docker Deployment

**User Story:** As a DevOps engineer, I want the application to be Docker-ready, so that it can be deployed consistently across environments.

#### Acceptance Criteria

1. THE System SHALL provide Docker configuration for both backend and frontend services
2. THE System SHALL use environment-based configuration for all external service credentials and URLs
3. THE System SHALL support separate environment configurations for development, staging, and production
4. THE System SHALL provide a Docker Compose configuration for local development with PostgreSQL

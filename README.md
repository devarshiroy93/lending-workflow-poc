# 📄 Lending Workflow POC

A proof-of-concept **event-driven loan workflow system** built with AWS (serverless) and React.  
The backend demonstrates **event-driven architecture with DynamoDB Streams, SNS, and SQS** for fault tolerance, back-pressure control, and auditability.  
The frontend (React + Tailwind, hosted on Firebase) provides a minimal borrower-facing UI.

---

## 🚀 Key Features

- **Event-driven workflow**: Loan submission → KYC → Compliance → Disbursement
- **Outbox pattern**: Reliable event publishing via DynamoDB Streams
- **SNS + SQS fan-out**: Decoupled services with natural back-pressure handling
- **Fault tolerance**: SQS retries, DLQs, idempotent processing
- **Append-only logs**: Full audit history via `LoanApplicationLogs` table
- **Borrower timeline**: React UI to display loan application events

---

## 🏗️ Backend (AWS Lambdas)

This project uses **DynamoDB, Lambda, SNS, and SQS** to model a loan lifecycle.  
Below are the Lambda modules inside `/lambdas`:

### 1. `submitApplication.ts`
- Trigger: **API Gateway** → `POST /applications`
- Creates a new record in `LoanApplications` table
- Writes an entry to **Outbox table**
- Ensures idempotency using conditional writes

### 2. `outboxProcessor.ts`
- Trigger: **DynamoDB Streams** on `LoanApplicationOutbox`
- Implements **CDC (Change Data Capture)**
- Reads staged outbox entries and publishes domain events to **SNS**
- Guarantees reliable event propagation even if initial write succeeded but publish failed

### 3. `kycService.ts`
- Trigger: **SQS** (subscribed to SNS topic with filter)
- Performs **KYC checks** on loan events
- Writes results into `LoanApplicationLogs`
- Uses SQS buffering for **back-pressure control** if traffic spikes

### 4. `complianceService.ts`
- Trigger: **SQS**
- Performs compliance checks
- Appends result logs
- Benefits from **fault tolerance**: retries, DLQ capture

### 5. `disbursementService.ts`
- Trigger: **SQS**
- Final step in the workflow: disburses approved loans
- Writes disbursement events into logs

### 6. `notificationService.ts`
- Trigger: **SNS/SQS** (fan-out)
- Translates backend events into borrower-facing notifications
- Writes into `Notifications` table for UI consumption

### 7. `getLoanApplications.ts`
- Trigger: **API Gateway** → `GET /applications`
- Queries `LoanApplications` table using **GSI on userId**

### 8. `getLoanApplicationLogs.ts`
- Trigger: **API Gateway** → `GET /applications/{id}/logs`
- Reads `LoanApplicationLogs` table to fetch timeline for a specific application
- Used by frontend timeline UI

---

## 📂 Data Model

- **LoanApplications**: main application records (PK = applicationId, GSI = userId)
- **LoanApplicationLogs**: append-only audit logs (eventType, actor, timestamp)
- **LoanApplicationOutbox**: staging area for Outbox pattern
- **Notifications**: borrower-facing messages for UI

---

## 📊 Event Flow

1. Borrower submits loan → `SubmitApplication` Lambda  
2. Record written to LoanApplications + Outbox  
3. `OutboxProcessor` consumes DynamoDB Stream, publishes to SNS  
4. SNS → SQS fan-out → `KYCService`, `ComplianceService`, `DisbursementService`  
5. Each service appends results into `LoanApplicationLogs`  
6. `NotificationService` writes borrower-facing notifications  
7. Borrower UI queries `/applications/{id}/logs` → timeline view  

---

## 🎨 Frontend (UI)

- Minimal **React + Tailwind** app hosted on Firebase
- Features:
  - Submit new loan
  - View all applications in a table
  - Expand row → borrower timeline (powered by `getLoanApplicationLogs`)

---

## 🐞 Fault Tolerance & Back Pressure

- **SNS → SQS**: each service has its own queue, isolates failures
- **SQS buffering**: prevents overload if downstream is slow
- **Retries & DLQs**: failed messages retried, then routed to Dead-Letter Queue
- **Idempotency**: DynamoDB conditional writes + deduplication logic
- **Audit logs**: Append-only logs provide full traceability

---

## ⚡ Startup / Setup

### Prerequisites
- Node.js 18+
- AWS CLI configured with credentials
- DynamoDB tables created (via IaC or console)
- API Gateway stage `/dev` created

### Clone & Install
```bash
git clone https://github.com/devarshiroy93/lending-workflow-poc.git
cd lending-workflow-poc
npm install

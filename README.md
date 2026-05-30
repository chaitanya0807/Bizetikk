# ScreenIQ — AI-Powered Candidate Screener

ScreenIQ is a full-stack application built for internal HR teams to screen candidates using Google Gemini 2.5 Flash AI. It evaluates a candidate's resume against a job description, providing an AI-generated score (1-10) and specific reasoning, securely stored and managed in a dashboard.

---

##  Setup Guide

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- A Google Gemini API Key

### Backend Setup (Django)

1. Navigate to the root directory and create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install django djangorestframework djangorestframework-simplejwt google-generativeai django-cors-headers
   ```
3. Environment variables: Set your Gemini API key in your terminal before running:
   ```bash
   # Linux/macOS
   export GEMINI_API_KEY="your-api-key-here"
   
   # Windows PowerShell
   $env:GEMINI_API_KEY="your-api-key-here"
   ```
4. Run migrations and start the server:
   ```bash
   cd backend
   python manage.py migrate
   python manage.py createsuperuser  # Create an admin user to login
   python manage.py runserver 8000
   ```
   *(Note: The database is configured to use SQLite by default to ensure it runs out-of-the-box on any machine without requiring a local Postgres installation. To switch to PostgreSQL, simply update the `DATABASES` dictionary in `backend/screeniq/settings.py`)*

### Frontend Setup (Next.js)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser. Login using the superuser credentials you created in step 4 above.

---

## 🛠️ Part A: Backend & Bug Fixes

### Task A-1: Bugs Fixed
The original `views.py` starter code contained several critical bugs which have been fixed:

1. **Missing Data Crash**: `request.data['key']` would throw a 500 error if the key was missing. Fixed by using `.get()` and explicitly returning a `400 Bad Request` if `job_description` or `resume` are missing.
2. **Deprecated OpenAI SDK**: The starter used `openai.ChatCompletion.create` which is deprecated. I entirely replaced the AI layer with the modern `google-generativeai` SDK for Gemini 2.5 Flash.
3. **Missing Authentication Check**: The view subclassed `APIView` but lacked `permission_classes = [IsAuthenticated]`. Anyone could hit the endpoint. Fixed by adding the permission class.
4. **Incorrect HTTP Status Code**: Creating a new screening returned `200 OK`. REST semantics dictate it should return `201 CREATED`. Fixed.
5. **Raw AI Score Storage**: The database stored the exact string the AI outputted (e.g., "Score: 7/10"). This breaks sorting and frontend logic. Fixed by passing the output through a backend `score_normalizer` before saving it as an integer.

### Task A-2: AI Prompt Design
The prompt is designed using a strict System/User separation.
- **Decision**: I enforced a rigid JSON output schema in the system prompt (`{"score": X, "reasons": [...]}`). 
- **Reasoning**: Without a strict structure, LLMs tend to be conversational ("Here is the score for the candidate..."). By forcing JSON, the backend can deterministically parse the score and array of reasons. I also explicitly instructed the AI to "Evaluate SKILLS and EXPERIENCE only, not name/university/location" as a first-line defense against bias, and provided a strict grading rubric (1-4 poor, 5-6 partial, etc.) to prevent score inflation.

### Task A-3: Security Vulnerability (IDOR)
- **Vulnerability**: The `ApplicationListView` returned `Application.objects.all()`. This is an Insecure Direct Object Reference (IDOR) — or Broken Object Level Authorization. Any authenticated user could see every other recruiter's screenings.
- **Fix**: Changed the queryset to `Application.objects.filter(created_by=request.user)`. Now, recruiters only see the screenings they generated themselves.

---

##  Part B: Frontend Architecture

### Task B-1: State Management Choice
- **Decision**: Used local component state (`useState` and `useReducer`) instead of a global store like Redux or Zustand.
- **Reasoning**: The screening form state (idle, loading, streaming, done, error) is highly localized. It does not need to be shared across the application. Using a global state manager for a single isolated workflow is over-engineering and adds unnecessary boilerplate. `useReducer` perfectly handles the complex state transitions of the streaming lifecycle.

### Task B-2: Pagination Tradeoff
- **Decision**: Implemented Server-Side Pagination (using Django Rest Framework's `PageNumberPagination`).
- **Reasoning**: While virtual scrolling provides a slightly slicker user experience (no page jumps), fetching 500+ rows into memory at once scales poorly as the database grows to thousands of records. Server-side pagination is robust, limits the API payload to 20 rows per request, and allows the backend database to efficiently handle memory and sorting via `LIMIT` and `OFFSET`. 

### Task B-3: AI Output Normalisation
- **Decision**: Handled normalisation on the **Backend**.
- **Reasoning**: The frontend should be a "dumb" display layer. By normalising the AI output in the backend before saving to the database, we ensure data integrity at the storage level. If we ever add a mobile app or a public API, the normalisation logic is already centralized. The frontend simply receives a clean, typed integer.

---

##  Part C: AI Integration & Streaming

### Task C-1: Streaming Approach
- **Decision**: Server-Sent Events (SSE) via Django `StreamingHttpResponse` and Next.js `ReadableStream`.
- **Reasoning**: I chose SSE over WebSockets (Django Channels) because streaming AI output is inherently unidirectional (server -> client). WebSockets require a heavy infrastructure lift (ASGI, Redis, connection management) which is overkill here. SSE works natively over standard HTTP, making it lightweight and trivial to deploy.

### Task C-2: Bias Detection (Written Answer)

**Detection**:
To detect whether ScreenIQ's AI is exhibiting bias based on non-skill attributes, I would run an automated A/B test using a framework of "counterfactual fairness." We would take a set of identical resumes and systematically perturb only the protected attributes—changing the name from "Greg" to "Jamal," or the university from a state school to an Ivy League—and run them through the AI against the same job description. We would then use statistical analysis (like ANOVA) to measure if the score variance significantly correlates with these demographic markers. Furthermore, in production, we would log anonymised candidate metadata and regularly calculate demographic parity against downstream hiring decisions.

**Reduction**:
If bias is detected, I would take several steps:
1. **Upstream Sanitisation**: The most foolproof method is to never let the AI see the biased data. We would run a Named Entity Recognition (NER) pass over the resume *before* it hits the LLM, masking names, locations, and universities with generic tokens (e.g., `[CANDIDATE_NAME]`, `[UNIVERSITY]`).
2. **Prompt Tuning**: Ensure the system prompt heavily penalizes assumptions and explicitly forces the model to cite the exact line in the resume that justifies its score.
3. **Model Calibration**: We would maintain a "golden dataset" of human-graded resumes. If the AI's distribution drifts from the human baseline along demographic lines, we would use that data for few-shot prompting or fine-tuning to correct the model's baseline behavior.

---

##  Tests

I wrote 3 core tests targeting the most critical, failure-prone logic:
1. `test_normaliser_edge_cases`: Tests the AI output normaliser against decimals, words, and garbage inputs (Task B-3).
2. `test_screen_endpoint_auth`: Tests that unauthenticated POST requests are rejected, validating the bug fix for missing `permission_classes`.
3. `test_application_list_filtered`: Tests the security fix (Task A-3) to ensure User A cannot see User B's records.

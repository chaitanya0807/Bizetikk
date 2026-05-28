import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.generics import ListAPIView
from django.http import StreamingHttpResponse

from .models import Application
from .serializers import ApplicationSerializer
from .services.score_normalizer import normalise_score
from .services.gemini_service import screen_candidate_stream

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class ScreenCandidateView(APIView):
    # BUG FIX 3: Missing authentication check. Anyone could POST screenings.
    # Added IsAuthenticated so only logged in users can create records.
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # BUG FIX 1: request.data['key'] throws KeyError if missing.
        # Used .get() and added validation to handle missing data gracefully.
        job_desc = request.data.get('job_description')
        resume   = request.data.get('resume')
        
        if not job_desc or not resume:
            return Response(
                {"error": "job_description and resume are required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # BUG FIX 2: openai.ChatCompletion.create is deprecated and we are using Gemini.
        # Using a service wrapper that implements streaming.
        
        # We will collect the full response to save to DB, but also support streaming.
        # However, for a standard POST, we just await the full response. 
        # (Task C-1 asks for streaming, which is usually done via a different content-type/endpoint, 
        # but we can implement it here if requested via a param, or just return SSE).
        
        # Let's check if the client wants a stream (SSE)
        stream = request.GET.get('stream', 'false').lower() == 'true'
        
        if stream:
            return self._stream_response(job_desc, resume, request.user)
            
        # Non-streaming fallback
        full_text = ""
        for chunk in screen_candidate_stream(job_desc, resume):
            full_text += chunk
            
        return self._save_and_respond(full_text, job_desc, resume, request.user)

    def _stream_response(self, job_desc, resume, user):
        def generate():
            full_text = ""
            try:
                for chunk in screen_candidate_stream(job_desc, resume):
                    full_text += chunk
                    # SSE format
                    yield f"data: {json.dumps({'chunk': chunk})}\n\n"
                    
                # Save to DB after streaming finishes
                app = self._save_to_db(full_text, job_desc, resume, user)
                
                # Send final confirmation with the saved ID
                yield f"data: {json.dumps({'done': True, 'id': app.id})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                
        return StreamingHttpResponse(generate(), content_type='text/event-stream')
        
    def _save_and_respond(self, full_text, job_desc, resume, user):
        app = self._save_to_db(full_text, job_desc, resume, user)
        # BUG FIX 4: Returning HTTP 200 OK for resource creation.
        # Changed to 201 CREATED which is the correct REST semantic.
        return Response(ApplicationSerializer(app).data, status=status.HTTP_201_CREATED)
        
    def _save_to_db(self, full_text, job_desc, resume, user):
        try:
            # Clean up potential markdown formatting from Gemini
            cleaned_text = full_text.strip()
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:]
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]
                
            data = json.loads(cleaned_text)
            raw_score = str(data.get('score', 0))
            reasons = data.get('reasons', [])
        except json.JSONDecodeError:
            raw_score = "0"
            reasons = ["Failed to parse AI response"]
            
        # BUG FIX 5: Storing raw AI score as string directly into DB.
        # Used normalise_score to convert edge cases ("Seven", "7.3") to an integer.
        score = normalise_score(raw_score)

        return Application.objects.create(
            job_description=job_desc,
            resume=resume,
            ai_score=score,
            reasons=reasons,
            created_by=user
        )

# TASK A-3: Find and Fix Security Vulnerability
class ApplicationListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ApplicationSerializer
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        # SECURITY VULNERABILITY FIX: IDOR (Insecure Direct Object Reference)
        # The starter code returned `Application.objects.all()`, meaning ANY authenticated user
        # could see ALL applications from EVERY user across the entire system.
        # Fix: Filter the queryset so users can only see their own applications.
        return Application.objects.filter(created_by=self.request.user).order_by('-created_at')

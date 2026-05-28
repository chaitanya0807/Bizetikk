from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from .models import Application
from .services.score_normalizer import normalise_score

class ScreenIQTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username='user1', password='password123')
        self.user2 = User.objects.create_user(username='user2', password='password123')
        
    def test_normaliser_edge_cases(self):
        """
        TEST 1: The normaliser is the most failure-prone logic (Task B-3).
        We test decimal, word, garbage inputs, and out-of-bounds numbers.
        """
        self.assertEqual(normalise_score("7.3"), 7)
        self.assertEqual(normalise_score("Seven"), 7)
        self.assertEqual(normalise_score("Score: 8/10"), 8)
        self.assertEqual(normalise_score("9.8 out of 10"), 10)
        self.assertEqual(normalise_score("15"), 10) # Clamped to 10
        self.assertEqual(normalise_score("-5"), 1)  # Clamped to 1
        self.assertEqual(normalise_score("Garbage response"), 0) # Unknown
        
    def test_screen_endpoint_auth(self):
        """
        TEST 2: Ensure unauthenticated requests cannot hit the API (Bug Fix #3).
        This guards the security requirement.
        """
        response = self.client.post('/api/screen/', {
            'job_description': 'Developer',
            'resume': 'I am a dev'
        })
        # Should be 401 Unauthorized, not 403 or 200
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
    def test_application_list_filtered(self):
        """
        TEST 3: IDOR Security Fix (Task A-3).
        Ensure user1 cannot see user2's applications.
        """
        Application.objects.create(
            job_description="Job 1", 
            resume="Resume 1", 
            ai_score=8, 
            created_by=self.user1
        )
        Application.objects.create(
            job_description="Job 2", 
            resume="Resume 2", 
            ai_score=9, 
            created_by=self.user2
        )
        
        # Authenticate as user1
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/applications/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see 1 application (their own), not 2
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['job_description'], "Job 1")

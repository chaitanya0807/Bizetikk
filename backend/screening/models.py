from django.db import models
from django.contrib.auth.models import User

class Application(models.Model):
    job_description = models.TextField()
    resume          = models.TextField()
    
    # Bug Fix / Improvement: Store as integer for consistent processing and sorting
    # The normalizer will handle converting AI output (e.g. 'Seven', '7.3') to an int.
    ai_score        = models.IntegerField()
    
    # Add reasons column to store the parsed AI reasons as JSON
    reasons         = models.JSONField(default=list)
    
    created_by      = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at      = models.DateTimeField(auto_now_add=True)

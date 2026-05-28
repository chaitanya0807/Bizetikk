from rest_framework import serializers
from .models import Application

class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ['id', 'job_description', 'resume', 'ai_score', 'reasons', 'created_at', 'created_by']
        read_only_fields = ['id', 'created_at', 'created_by', 'ai_score', 'reasons']

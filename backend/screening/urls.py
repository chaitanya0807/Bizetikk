from django.urls import path
from .views import ScreenCandidateView, ApplicationListView

urlpatterns = [
    path('screen/', ScreenCandidateView.as_view(), name='screen-candidate'),
    path('applications/', ApplicationListView.as_view(), name='application-list'),
]

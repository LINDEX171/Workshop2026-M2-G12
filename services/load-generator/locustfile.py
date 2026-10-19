"""Trafic normal (preuve de vie + entraînement ML). Scénarios métier ajoutés en Phase 6."""
from locust import HttpUser, between, task


class NormalUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # Le WAF présente un certificat auto-signé en démo
        self.client.verify = False

    @task
    def home(self):
        self.client.get("/")

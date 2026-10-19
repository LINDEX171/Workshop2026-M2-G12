"""Trafic NORMAL d'un opérateur (preuve de vie + données d'entraînement du modèle ML).

Chaque utilisateur simulé consulte les comptes et les transactions et fait de
petits virements aléatoires entre les 3 comptes (les soldes font une marche
aléatoire, sans se vider). Tout passe par le WAF.

Le token est partagé par tous les utilisateurs simulés : le WAF limite les logins
(anti brute force) et voit tout le trafic depuis la même IP derrière Docker Desktop.
Sans partage, une montée en charge échouerait au login au lieu de solliciter le paiement.
"""
import random
from pathlib import Path

from locust import HttpUser, between, task

PASSWORD = Path("/run/secrets/operator_password").read_text().strip()
ACCOUNTS = [1, 2, 3]

_token: str | None = None


class Operator(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # Le WAF présente un certificat auto-signé (ou mkcert) en démo
        self.client.verify = False
        if _token is None:
            self.login()

    def login(self):
        global _token
        r = self.client.post(
            "/api/auth/login", json={"username": "operator", "password": PASSWORD}, name="login"
        )
        if r.ok:
            _token = r.json()["token"]

    @property
    def headers(self):
        return {"Authorization": f"Bearer {_token}"} if _token else {}

    def call(self, method, path, name, **kwargs):
        with self.client.request(
            method, path, headers=self.headers, name=name, catch_response=True, **kwargs
        ) as r:
            if r.status_code == 401:  # token expiré : nouvelle connexion
                r.success()
                self.login()
            elif r.status_code == 422:  # solde insuffisant : rejet métier normal
                r.success()

    @task(3)
    def accounts(self):
        self.call("GET", "/api/pay/accounts", "accounts")

    @task(3)
    def transactions(self):
        self.call("GET", "/api/pay/transactions?limit=20", "transactions")

    @task(2)
    def transfer(self):
        src, dst = random.sample(ACCOUNTS, 2)
        amount = round(random.uniform(1, 5), 2)
        self.call("POST", "/api/pay/transactions", "transfer", json={"src": src, "dst": dst, "amount": amount})

    @task(1)
    def home(self):
        self.call("GET", "/", "home")

FROM locustio/locust:2.32.4

COPY locustfile.py /home/locust/locustfile.py

# Mode headless : paramètres via LOCUST_HOST, LOCUST_USERS, LOCUST_SPAWN_RATE
CMD ["-f", "/home/locust/locustfile.py", "--headless"]

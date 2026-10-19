.PHONY: up down reset logs ps health build
up:      ; docker compose --profile full up -d
down:    ; docker compose --profile full down
reset:   ; docker compose --profile full down -v --remove-orphans && docker compose --profile full up -d
build:   ; docker compose --profile full build
ps:      ; docker compose ps
logs:    ; docker compose logs -f $(svc)
health:  ; ./scripts/healthcheck_all.sh

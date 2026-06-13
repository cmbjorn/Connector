.PHONY: setup install dev build help

help:
	@echo "Connector — Piping Alignment Solver"
	@echo ""
	@echo "Commands:"
	@echo "  make setup    — Check Node.js and install dependencies"
	@echo "  make install  — Install npm dependencies"
	@echo "  make dev      — Start dev server (http://localhost:5173)"
	@echo "  make build    — Build for production"
	@echo "  make help     — Show this message"

setup:
	@bash setup.sh

install:
	npm install

dev:
	npm run dev

build:
	npm run build

clean:
	rm -rf node_modules package-lock.json dist

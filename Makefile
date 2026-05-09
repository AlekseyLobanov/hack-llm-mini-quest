.PHONY: run test web-install web-build

run:
	cd backend && uv run main.py --config ../config.toml

test:
	cd backend && uv run --group dev pytest --cov=. --cov-report=term-missing

web-install:
	npm --prefix web install

web-build:
	npm --prefix web run build

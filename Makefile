run:
	cd backend && uv run main.py --config ../config.toml

web-install:
	npm --prefix web install

web-build:
	npm --prefix web run build

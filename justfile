export PATH := "./node_modules/.bin:" + env_var('PATH')

dev:
  vite dev

build:
  vite build

preview:
  vite preview

check:
  svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
  prettier --plugin-search-dir . --check . && eslint .
  eslint

format:
  eslint --fix
  prettier --plugin-search-dir . --write .

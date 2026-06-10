#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="wikistr"
SERVICE_NAME="wikistr"
INSTALL_DIR="/var/www/wikistr"
SERVICE_USER="www-data"
SERVICE_GROUP="www-data"
PORT="3000"
PROXY_MODE="auto"
DOMAIN=""
CADDY_EMAIL=""
SSH_PORT="22"
DRY_RUN=false
SKIP_BUILD=false
SSH_TARGET=""
SSH_LOGIN_USER=""
SSH_CONTROL_PATH="${TMPDIR:-/tmp}/wikistr-ssh-%C"
REMOTE_STAGE_DIR="/tmp/${SERVICE_NAME}-deploy"
TOTAL_STEPS=4
CURRENT_STEP=0
CURRENT_STEP_LABEL=""
TTY_AVAILABLE=false
USE_COLOR=false
SPINNER_PID=""
SPINNER_LABEL=""
SPINNER_RUNNING=false

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE_SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

log() {
	printf '[deploy] %s\n' "$*"
}

warn() {
	printf '[deploy] warning: %s\n' "$*" >&2
}

die() {
	printf '[deploy] error: %s\n' "$*" >&2
	exit 1
}

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
	USE_COLOR=true
fi

if [[ "$USE_COLOR" == true ]]; then
	C_RESET=$'\033[0m'
	C_BOLD=$'\033[1m'
	C_DIM=$'\033[2m'
	C_RED=$'\033[31m'
	C_GREEN=$'\033[32m'
	C_YELLOW=$'\033[33m'
	C_BLUE=$'\033[34m'
	C_CYAN=$'\033[36m'
else
	C_RESET=''
	C_BOLD=''
	C_DIM=''
	C_RED=''
	C_GREEN=''
	C_YELLOW=''
	C_BLUE=''
	C_CYAN=''
fi

paint() {
	local color="$1"
	shift
	printf '%s%s%s' "$color" "$*" "$C_RESET"
}

status_good() { paint "$C_GREEN" "$*"; }
status_bad() { paint "$C_RED" "$*"; }
status_warn() { paint "$C_YELLOW" "$*"; }
status_info() { paint "$C_CYAN" "$*"; }

hr() {
	local width="${1:-72}"
	printf '%*s\n' "$width" '' | tr ' ' '-'
}

panel_line() {
	local text="$1"
	printf '| %-*s |\n' 68 "${text:0:68}"
}

render_header() {
	local proxy_display="$PROXY_MODE"
	if [[ "$PROXY_MODE" == "auto" && -n "$proxy_mode_resolved" ]]; then
		proxy_display="auto -> ${proxy_mode_resolved}"
	fi

	printf '\n'
	hr
	panel_line "$(status_info "wikistr deploy installer")"
	hr
	panel_line "target   : ${SSH_TARGET}"
	panel_line "install  : ${INSTALL_DIR}"
	panel_line "service  : ${SERVICE_NAME}"
	panel_line "port     : ${PORT}"
	panel_line "proxy    : ${proxy_display}"
	panel_line "domain   : ${DOMAIN:-<none>}"
	panel_line "build    : $([[ "$SKIP_BUILD" == true ]] && printf 'skip local build' || printf 'npm ci + npm run build')"
	panel_line "tty      : $([[ "$TTY_AVAILABLE" == true ]] && printf 'interactive' || printf 'non-interactive')"
	hr
	printf '\n'
}

spinner_start() {
	local label="$1"
	SPINNER_LABEL="$label"
	SPINNER_RUNNING=true
	if [[ "$USE_COLOR" != true ]]; then
		return 0
	fi

	(
		local frames=('|' '/' '-' '\\')
		local i=0
		while :; do
			printf '\r%s %s' "$(status_info "${frames[i % 4]}")" "$SPINNER_LABEL" >&2
			i=$((i + 1))
			sleep 0.1
		done
	) &
	SPINNER_PID=$!
}

spinner_stop() {
	local result="${1:-0}"
	SPINNER_RUNNING=false
	if [[ -n "$SPINNER_PID" ]]; then
		kill "$SPINNER_PID" 2>/dev/null || true
		wait "$SPINNER_PID" 2>/dev/null || true
		SPINNER_PID=""
	fi
	if [[ "$USE_COLOR" == true ]]; then
		printf '\r%*s\r' 120 '' >&2
	fi
	if [[ "$result" == 0 ]]; then
		printf '%s %s\n' "$(status_good '[ok]')" "$SPINNER_LABEL"
	else
		printf '%s %s\n' "$(status_bad '[fail]')" "$SPINNER_LABEL"
	fi
	SPINNER_LABEL=""
}

run_spinner() {
	local label="$1"
	shift
	if [[ "$USE_COLOR" != true ]]; then
		"$@"
		return
	fi

	spinner_start "$label"
	if "$@"; then
		spinner_stop 0
	else
		local rc=$?
		spinner_stop "$rc"
		return "$rc"
	fi
}

step_begin() {
	CURRENT_STEP=$((CURRENT_STEP + 1))
	CURRENT_STEP_LABEL="$1"
	printf '\n%s [%d/%d] %s\n' "$(status_info '>>>')" "$CURRENT_STEP" "$TOTAL_STEPS" "$CURRENT_STEP_LABEL"
}

step_done() {
	printf '%s [%d/%d] %s\n' "$(status_good '[ok]')" "$CURRENT_STEP" "$TOTAL_STEPS" "$CURRENT_STEP_LABEL"
	CURRENT_STEP_LABEL=""
}

on_error() {
	local exit_code="$1"
	local line_no="$2"
	if [[ -n "$CURRENT_STEP_LABEL" ]]; then
		printf '\n%s [%d/%d] %s\n' "$(status_bad '[fail]')" "$CURRENT_STEP" "$TOTAL_STEPS" "$CURRENT_STEP_LABEL" >&2
	fi
	printf '%s command failed at line %s (exit %s)\n' "$(status_bad '[deploy] error:')" "$line_no" "$exit_code" >&2
}

usage() {
	cat <<'EOF'
Usage:
  scripts/deploy-remote.sh --host user@server [options]

Options:
  --host <user@host>       SSH target for the remote server
  --port <port>            App port on the remote host (default: 3000)
  --install-dir <path>     Remote install path (default: /var/www/wikistr)
  --service-user <user>    Systemd service user (default: www-data)
  --service-group <group>  Systemd service group (default: www-data)
  --proxy auto|caddy|nginx|none  Reverse proxy mode (default: auto)
  --domain <hostname>      Reverse proxy hostname (required for caddy/nginx)
  --caddy-email <email>    Caddy ACME contact email
  --ssh-port <port>        SSH port (default: 22)
  --skip-build             Skip the local build step
  --dry-run                Print actions without executing them
  -h, --help               Show this help

Environment overrides:
  WIKISTR_SSH_TARGET, WIKISTR_PORT, WIKISTR_INSTALL_DIR,
  WIKISTR_SERVICE_USER, WIKISTR_SERVICE_GROUP, WIKISTR_PROXY,
  WIKISTR_DOMAIN, WIKISTR_CADDY_EMAIL, WIKISTR_SSH_PORT,
  WIKISTR_DRY_RUN, WIKISTR_SKIP_BUILD
EOF
}

is_true() {
	case "${1,,}" in
		1|true|yes|on) return 0 ;;
		*) return 1 ;;
	esac
}

run_local() {
	if [[ "$DRY_RUN" == true ]]; then
		printf '[dry-run] '
		printf '%q ' "$@"
		printf '\n'
		return 0
	fi
	"$@"
}

ssh_common_opts() {
	printf -- '-o ControlMaster=auto -o ControlPersist=10m -o ControlPath=%q' "$SSH_CONTROL_PATH"
}

ssh_interactive_opts() {
	printf '%s' '-tt -o RequestTTY=force'
}

open_ssh_master() {
	if [[ "$DRY_RUN" == true ]]; then
		printf '[dry-run] ssh -MNf -p %s %s\n' "$SSH_PORT" "$SSH_TARGET"
		return 0
	fi
	ssh -MNf -p "$SSH_PORT" \
		-o "ControlMaster=auto" \
		-o "ControlPersist=10m" \
		-o "ControlPath=${SSH_CONTROL_PATH}" \
		"$SSH_TARGET"
}

run_remote() {
	local script="$1"
	shift || true
	local remote_args
	printf -v remote_args '%q %q %q %q %q %q %q %q' \
		"$INSTALL_DIR" "$SERVICE_NAME" "$SERVICE_USER" "$SERVICE_GROUP" "$PORT" "$PROXY_MODE" "$DOMAIN" "$CADDY_EMAIL"
	if [[ "$DRY_RUN" == true ]]; then
		printf '[dry-run] ssh -tt -p %s -o ControlMaster=auto -o ControlPersist=10m -o ControlPath=%q %s bash -s -- %s\n' \
			"$SSH_PORT" "$SSH_CONTROL_PATH" "$SSH_TARGET" "$remote_args"
		printf '%s\n' "$script"
		return 0
	fi
	ssh -tt -p "$SSH_PORT" \
		-o "ControlMaster=auto" \
		-o "ControlPersist=10m" \
		-o "ControlPath=${SSH_CONTROL_PATH}" \
		"$SSH_TARGET" "bash -s -- $remote_args" <<<"$script"
}

build_app() {
	if [[ "$DRY_RUN" == true ]]; then
		step_begin "local build (dry-run)"
		log "skipping local build"
		step_done
		return
	fi
	if [[ "$SKIP_BUILD" == true ]]; then
		step_begin "local build (skipped)"
		log "skipping local build"
		step_done
		return
	fi

	step_begin "install local dependencies"
	(
		cd "$REPO_ROOT"
		npm ci
	)
	step_done

	step_begin "build local app"
	(
		cd "$REPO_ROOT"
		npm run build
	)
	step_done
}

sync_app() {
	step_begin "sync repository"
	log "copying repo to ${SSH_TARGET}:${REMOTE_STAGE_DIR}"
	if [[ "$DRY_RUN" != true ]]; then
		open_ssh_master
	fi
	run_local rsync -az --delete --no-owner --no-group -e "ssh -p ${SSH_PORT} -o ControlMaster=auto -o ControlPersist=10m -o ControlPath=${SSH_CONTROL_PATH}" \
		--exclude='.git' \
		--exclude='.claude' \
		--exclude='node_modules' \
		--exclude='build' \
		--exclude='coverage' \
		"${REPO_ROOT}/" "${SSH_TARGET}:${REMOTE_STAGE_DIR}/"

	if [[ -d "${REPO_ROOT}/build" ]]; then
		log "copying build artifacts"
		run_local rsync -az --delete --no-owner --no-group -e "ssh -p ${SSH_PORT} -o ControlMaster=auto -o ControlPersist=10m -o ControlPath=${SSH_CONTROL_PATH}" \
			"${REPO_ROOT}/build/" "${SSH_TARGET}:${REMOTE_STAGE_DIR}/build/"
	fi
	step_done
}

install_remote_service() {
	step_begin "install remote service"
	local remote_script
	remote_script="$(cat <<'EOF'
set -Eeuo pipefail

INSTALL_DIR="$1"
STAGING_DIR="$2"
SERVICE_NAME="$3"
SERVICE_USER="$4"
SERVICE_GROUP="$5"
PORT="$6"
PROXY_MODE="$7"
DOMAIN="$8"
CADDY_EMAIL="$9"
DRY_RUN=false
CURRENT_STEP=0
CURRENT_STEP_LABEL=""

log() {
	printf '[remote] %s\n' "$*"
}

warn() {
	printf '[remote] warning: %s\n' "$*" >&2
}

die() {
	printf '[remote] error: %s\n' "$*" >&2
	exit 1
}

hr() {
	local width="${1:-64}"
	printf '%*s\n' "$width" '' | tr ' ' '-'
}

panel_line() {
	local text="$1"
	printf '| %-*s |\n' 60 "${text:0:60}"
}

remote_step_begin() {
	CURRENT_STEP=$((CURRENT_STEP + 1))
	CURRENT_STEP_LABEL="$1"
	printf '\n[remote %d] >>> %s\n' "$CURRENT_STEP" "$CURRENT_STEP_LABEL"
}

remote_step_done() {
	printf '[remote %d] [ok] %s\n' "$CURRENT_STEP" "$CURRENT_STEP_LABEL"
	CURRENT_STEP_LABEL=""
}

sudo_run() {
	sudo -n "$@"
}

port_is_listening() {
	ss -H -ltn "sport = :${PORT}" | grep -q .
}

service_is_active() {
	sudo_run systemctl is-active --quiet "${SERVICE_NAME}.service"
}

wait_for_ready() {
	local attempt
	for attempt in $(seq 1 30); do
		if service_is_active && port_is_listening; then
			return 0
		fi
		sleep 1
	done

	warn "service did not become ready on port ${PORT}"
	sudo_run systemctl status "${SERVICE_NAME}.service" --no-pager -l || true
	sudo_run journalctl -u "${SERVICE_NAME}.service" --no-pager -n 100 || true
	die "service failed to bind to port ${PORT}"
}

choose_port() {
	local candidate="$PORT"
	while ss -H -ltn "sport = :${candidate}" | grep -q .; do
		candidate=$((candidate + 1))
		if (( candidate > 65535 )); then
			die "no free ports available starting from ${PORT}"
		fi
	done
	if [[ "$candidate" != "$PORT" ]]; then
		warn "port ${PORT} is in use; using ${candidate} instead"
	fi
	PORT="$candidate"
}

verify_build_artifacts() {
	if [[ "${DRY_RUN:-false}" == true ]]; then
		return
	fi
	if [[ ! -f "${INSTALL_DIR}/build/index.html" ]]; then
		die "missing build artifact at ${INSTALL_DIR}/build/index.html"
	fi
}

is_true() {
	case "${1,,}" in
		1|true|yes|on) return 0 ;;
		*) return 1 ;;
	esac
}

trim() {
	sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

managed_marker="# managed by wikistr"
proxy_mode_resolved="$PROXY_MODE"

command -v python3 >/dev/null 2>&1 || die "python3 is required on the remote server"
command -v systemctl >/dev/null 2>&1 || die "systemctl is required on the remote server"
command -v ss >/dev/null 2>&1 || die "ss is required on the remote server"
command -v curl >/dev/null 2>&1 || die "curl is required on the remote server"
command -v rsync >/dev/null 2>&1 || die "rsync is required on the remote server"

log "refreshing sudo credentials"
sudo -v

if [[ "$proxy_mode_resolved" == "auto" ]]; then
	if command -v caddy >/dev/null 2>&1; then
		proxy_mode_resolved="caddy"
	elif command -v nginx >/dev/null 2>&1; then
		proxy_mode_resolved="nginx"
	else
		proxy_mode_resolved="none"
	fi
fi

printf '\n'
hr
panel_line "wikistr remote installer"
hr
panel_line "install  : ${INSTALL_DIR}"
panel_line "service  : ${SERVICE_NAME}"
panel_line "port     : ${PORT}"
panel_line "proxy    : ${proxy_mode_resolved}"
panel_line "domain   : ${DOMAIN:-<none>}"
hr
printf '\n'

remote_step_begin "prepare install directory"
if [[ "$proxy_mode_resolved" != "none" && -z "$DOMAIN" ]]; then
	die "a domain is required when reverse proxying"
fi
sudo_run install -d -m 0755 "$INSTALL_DIR"
sudo_run rsync -a --delete "$STAGING_DIR"/ "$INSTALL_DIR"/
sudo_run chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "$INSTALL_DIR"
remote_step_done

write_managed_file() {
	local target="$1"
	local content="$2"
	if [[ -f "$target" ]] && ! grep -qF "$managed_marker" "$target"; then
		die "${target} exists and is not managed by this script; refusing to overwrite"
	fi
	local tmp
	tmp="$(mktemp)"
	printf '%s\n' "$content" >"$tmp"
	sudo_run install -d -m 0755 "$(dirname "$target")"
	sudo_run install -m 0644 "$tmp" "$target"
	rm -f "$tmp"
}

install_service() {
	remote_step_begin "write systemd service"
	cat >/tmp/${SERVICE_NAME}.service <<SERVICEEOF
[Unit]
Description=${SERVICE_NAME} static web app
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
User=${SERVICE_USER}
Group=${SERVICE_GROUP}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/scripts/spa-http-server.py ${INSTALL_DIR}/build --bind 127.0.0.1 --port ${PORT}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICEEOF

	sudo_run install -m 0644 /tmp/${SERVICE_NAME}.service /etc/systemd/system/${SERVICE_NAME}.service
	rm -f /tmp/${SERVICE_NAME}.service
	remote_step_done
}

detect_caddy_snippet_dir() {
	local main_file="/etc/caddy/Caddyfile"
	local dir
	if [[ -n "${WIKISTR_CADDY_SNIPPET_DIR:-}" ]]; then
		printf '%s' "$WIKISTR_CADDY_SNIPPET_DIR"
		return 0
	fi
	if [[ -f "$main_file" ]]; then
		for dir in /etc/caddy/conf.d /etc/caddy/Caddyfile.d; do
			if grep -qE "^[[:space:]]*import[[:space:]].*${dir}/\\*\\.caddy" "$main_file" 2>/dev/null; then
				printf '%s' "$dir"
				return 0
			fi
		done
	fi
	for dir in /etc/caddy/conf.d /etc/caddy/Caddyfile.d; do
		if [[ -d "$dir" ]]; then
			printf '%s' "$dir"
			return 0
		fi
	done
	printf '%s' /etc/caddy/conf.d
}

configure_caddy() {
	local domain="$1"
	local port="$2"
	local main_file="/etc/caddy/Caddyfile"
	local snippet_dir snippet_file import_line content
	remote_step_begin "configure caddy"
	snippet_dir="$(detect_caddy_snippet_dir)"
	snippet_file="${snippet_dir}/${SERVICE_NAME}.caddy"
	import_line="import ${snippet_dir}/*.caddy"

	log "configuring caddy for ${domain}"
	sudo_run install -d -m 0755 "$snippet_dir"
	content="${managed_marker}
${domain} {
	${CADDY_EMAIL:+tls ${CADDY_EMAIL}}
	encode zstd gzip
	reverse_proxy localhost:${port}
}"
	write_managed_file "$snippet_file" "$content"

	if [[ ! -f "$main_file" ]]; then
		write_managed_file "$main_file" "${managed_marker}
${import_line}"
	else
		if grep -qE '^[[:space:]]*import[[:space:]].*(/etc/caddy/)?(conf\.d|Caddyfile\.d)/\*\.caddy' "$main_file"; then
			log "existing Caddyfile already imports a snippet directory; leaving it unchanged"
		elif grep -qF "$managed_marker" "$main_file"; then
			log "existing Caddyfile is managed by wikistr; adding snippet import"
			local current_content
			current_content="$(cat "$main_file")"
			write_managed_file "$main_file" "${current_content}

${import_line}"
		else
			warn "existing Caddyfile does not import ${snippet_dir}; not modifying it"
			warn "add this line manually if needed: ${import_line}"
		fi
	fi

	if command -v caddy >/dev/null 2>&1; then
		sudo_run caddy validate --config "$main_file"
	fi
	remote_step_done
}

detect_nginx_style() {
	local nginx_main="/etc/nginx/nginx.conf"
	if [[ -n "${WIKISTR_NGINX_STYLE:-}" ]]; then
		printf '%s' "$WIKISTR_NGINX_STYLE"
		return 0
	fi
	if [[ -f "$nginx_main" ]] && grep -qE 'include[[:space:]]+.*/conf\.d/\*\.conf;' "$nginx_main"; then
		printf '%s' "conf.d"
		return 0
	fi
	if [[ -f "$nginx_main" ]] && grep -qE 'include[[:space:]]+.*/sites-enabled/\*;' "$nginx_main"; then
		printf '%s' "sites"
		return 0
	fi
	printf '%s' "unknown"
}

configure_nginx() {
	local domain="$1"
	local port="$2"
	local style
	local nginx_main="/etc/nginx/nginx.conf"
	style="$(detect_nginx_style)"

	log "configuring nginx for ${domain}"
	remote_step_begin "configure nginx"
	case "$style" in
		conf.d)
			local conf_file="/etc/nginx/conf.d/${SERVICE_NAME}.conf"
			local content
			content="${managed_marker}
server {
	listen 80;
	server_name ${domain};

	location / {
		proxy_pass http://127.0.0.1:${port};
		proxy_http_version 1.1;
		proxy_set_header Upgrade \$http_upgrade;
		proxy_set_header Connection \"upgrade\";
		proxy_set_header Host \$host;
		proxy_set_header X-Real-IP \$remote_addr;
		proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto \$scheme;
		proxy_read_timeout 3600;
		proxy_send_timeout 3600;
	}
}"
			write_managed_file "$conf_file" "$content"
			;;
		sites)
			local sites_available="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
			local sites_enabled="/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
			local content
			content="${managed_marker}
server {
	listen 80;
	server_name ${domain};

	location / {
		proxy_pass http://127.0.0.1:${port};
		proxy_http_version 1.1;
		proxy_set_header Upgrade \$http_upgrade;
		proxy_set_header Connection \"upgrade\";
		proxy_set_header Host \$host;
		proxy_set_header X-Real-IP \$remote_addr;
		proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto \$scheme;
		proxy_read_timeout 3600;
		proxy_send_timeout 3600;
	}
}"
			write_managed_file "$sites_available" "$content"
			if [[ -e "$sites_enabled" && ! -L "$sites_enabled" ]]; then
				die "${sites_enabled} exists and is not a symlink; refusing to overwrite"
			fi
			if [[ -L "$sites_enabled" ]]; then
				local current_target
				current_target="$(readlink "$sites_enabled")"
				if [[ "$current_target" != "$sites_available" ]]; then
					die "${sites_enabled} points to ${current_target}; refusing to change it"
				fi
			else
				sudo_run ln -s "$sites_available" "$sites_enabled"
			fi
			;;
		unknown)
			warn "/etc/nginx/nginx.conf does not clearly enable conf.d or sites-enabled"
			warn "leaving nginx configuration unchanged"
			return 0
			;;
	esac

	sudo_run nginx -t
	sudo_run systemctl reload nginx 2>/dev/null || sudo_run systemctl restart nginx
	remote_step_done
}

configure_proxy() {
	case "$proxy_mode_resolved" in
		none)
			log "reverse proxy disabled"
			return 0
			;;
		caddy)
			command -v caddy >/dev/null 2>&1 || die "caddy is not installed on the remote server"
			configure_caddy "$DOMAIN" "$PORT"
			;;
		nginx)
			command -v nginx >/dev/null 2>&1 || die "nginx is not installed on the remote server"
			configure_nginx "$DOMAIN" "$PORT"
			;;
		*)
			die "unknown proxy mode: $proxy_mode_resolved"
			;;
	esac
}

log "normalizing ownership"
sudo_run chmod 0755 "$INSTALL_DIR"

log "stopping existing service"
sudo_run systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true

if port_is_listening; then
	choose_port
	log "selected port ${PORT}"
fi

verify_build_artifacts

install_service

log "reloading systemd"
sudo_run systemctl daemon-reload
sudo_run systemctl reset-failed "${SERVICE_NAME}.service" 2>/dev/null || true
sudo_run systemctl enable "${SERVICE_NAME}.service"
sudo_run systemctl start "${SERVICE_NAME}.service"

remote_step_begin "smoke test"
wait_for_ready
curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null
curl -fsS "http://127.0.0.1:${PORT}/does-not-exist" >/dev/null
remote_step_done

configure_proxy

log "deployment complete"
EOF
)"
	local remote_script_file
	remote_script_file="$(mktemp)"
	printf '%s\n' "$remote_script" >"$remote_script_file"
	if [[ "$DRY_RUN" == true ]]; then
		local remote_args
		printf -v remote_args '%q %q %q %q %q %q %q %q %q' \
			"$INSTALL_DIR" "$REMOTE_STAGE_DIR" "$SERVICE_NAME" "$SERVICE_USER" "$SERVICE_GROUP" "$PORT" "$PROXY_MODE" "$DOMAIN" "$CADDY_EMAIL"
		printf '[dry-run] scp -P %s -o ControlMaster=auto -o ControlPersist=10m -o ControlPath=%q %q %q:%q\n' \
			"$SSH_PORT" "$SSH_CONTROL_PATH" "$remote_script_file" "$SSH_TARGET" "/tmp/${SERVICE_NAME}-deploy.sh"
		printf '[dry-run] ssh -tt -p %s -o ControlMaster=auto -o ControlPersist=10m -o ControlPath=%q %q bash %q %s\n' \
			"$SSH_PORT" "$SSH_CONTROL_PATH" "$SSH_TARGET" "/tmp/${SERVICE_NAME}-deploy.sh" "$remote_args"
		rm -f "$remote_script_file"
		step_done
		return 0
	fi
	open_ssh_master
	scp -P "$SSH_PORT" \
		-o "ControlMaster=auto" \
		-o "ControlPersist=10m" \
		-o "ControlPath=${SSH_CONTROL_PATH}" \
		"$remote_script_file" "$SSH_TARGET:/tmp/${SERVICE_NAME}-deploy.sh"
	rm -f "$remote_script_file"
	ssh -tt -p "$SSH_PORT" \
		-o "ControlMaster=auto" \
		-o "ControlPersist=10m" \
		-o "ControlPath=${SSH_CONTROL_PATH}" \
		"$SSH_TARGET" "bash /tmp/${SERVICE_NAME}-deploy.sh $(printf '%q ' "$INSTALL_DIR" "$REMOTE_STAGE_DIR" "$SERVICE_NAME" "$SERVICE_USER" "$SERVICE_GROUP" "$PORT" "$PROXY_MODE" "$DOMAIN" "$CADDY_EMAIL")"
	step_done
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--host)
			SSH_TARGET="${2:-}"
			shift 2
			;;
		--port)
			PORT="${2:-}"
			shift 2
			;;
		--install-dir)
			INSTALL_DIR="${2:-}"
			shift 2
			;;
		--service-user)
			SERVICE_USER="${2:-}"
			shift 2
			;;
		--service-group)
			SERVICE_GROUP="${2:-}"
			shift 2
			;;
		--proxy)
			PROXY_MODE="${2:-}"
			shift 2
			;;
		--domain)
			DOMAIN="${2:-}"
			shift 2
			;;
		--caddy-email)
			CADDY_EMAIL="${2:-}"
			shift 2
			;;
		--ssh-port)
			SSH_PORT="${2:-}"
			shift 2
			;;
		--skip-build)
			SKIP_BUILD=true
			shift
			;;
		--dry-run)
			DRY_RUN=true
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			die "unknown option: $1"
			;;
	esac
done

if [[ -z "$SSH_TARGET" ]]; then
	SSH_TARGET="${WIKISTR_SSH_TARGET:-}"
fi
if [[ -z "$SSH_TARGET" ]]; then
	usage
	die "missing required option: --host"
fi

if [[ "$PORT" == "3000" && -n "${WIKISTR_PORT:-}" ]]; then
	PORT="$WIKISTR_PORT"
fi
if [[ "$INSTALL_DIR" == "/var/www/wikistr" && -n "${WIKISTR_INSTALL_DIR:-}" ]]; then
	INSTALL_DIR="$WIKISTR_INSTALL_DIR"
fi
if [[ "$SERVICE_USER" == "www-data" && -n "${WIKISTR_SERVICE_USER:-}" ]]; then
	SERVICE_USER="$WIKISTR_SERVICE_USER"
fi
if [[ "$SERVICE_GROUP" == "www-data" && -n "${WIKISTR_SERVICE_GROUP:-}" ]]; then
	SERVICE_GROUP="$WIKISTR_SERVICE_GROUP"
fi
if [[ "$PROXY_MODE" == "auto" && -n "${WIKISTR_PROXY:-}" ]]; then
	PROXY_MODE="$WIKISTR_PROXY"
fi
if [[ -z "$DOMAIN" ]]; then
	DOMAIN="${WIKISTR_DOMAIN:-}"
fi
if [[ -z "$CADDY_EMAIL" ]]; then
	CADDY_EMAIL="${WIKISTR_CADDY_EMAIL:-}"
fi
if [[ "$SSH_PORT" == "22" && -n "${WIKISTR_SSH_PORT:-}" ]]; then
	SSH_PORT="$WIKISTR_SSH_PORT"
fi
if [[ "$DRY_RUN" == false && -n "${WIKISTR_DRY_RUN:-}" ]]; then
	is_true "$WIKISTR_DRY_RUN" && DRY_RUN=true || true
fi
if [[ "$SKIP_BUILD" == false && -n "${WIKISTR_SKIP_BUILD:-}" ]]; then
	is_true "$WIKISTR_SKIP_BUILD" && SKIP_BUILD=true || true
fi

proxy_mode_resolved="$PROXY_MODE"

trap 'on_error $? $LINENO' ERR

if [[ "$DRY_RUN" == true ]]; then
	log "performing dry-run deployment"
fi

if [[ ! -t 0 ]]; then
	log "non-interactive tty"
else
	TTY_AVAILABLE=true
fi

render_header

build_app
sync_app
install_remote_service

log "done"

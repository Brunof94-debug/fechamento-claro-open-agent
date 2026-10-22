"""Local-only first-run setup of the official private Zetaris distribution.

Never evaluates copied commands or prints credentials. Requires the licensed
bundle and the registry command obtained from the authorized account.
"""
import json, os, pathlib, re, secrets, shlex, shutil, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.runtime'
BUNDLE = PRIVATE / 'zetaris' / 'zetaris-platform'
CONFIG = PRIVATE / 'docker-config'
HOST = 'npipe:////./pipe/dockerDesktopLinuxEngine'
BASE = ['docker', '--host', HOST, '--config', str(CONFIG)]

def main():
    if not BUNDLE.is_dir():
        raise SystemExit('Obtain the official platform bundle first.')
    info = subprocess.run(BASE + ['info', '--format', '{{json .}}'], capture_output=True, text=True, timeout=30)
    if info.returncode:
        raise SystemExit('Docker engine is not reachable; no setup changes made.')
    state=json.loads(info.stdout)
    if state['MemTotal'] < 6*1024**3 or state['NCPU'] < 4 or shutil.disk_usage(ROOT).free < 15*1024**3:
        raise SystemExit('Machine does not pass the official minimum resource checks.')
    print(f"Docker preflight: {state['NCPU']} CPUs, {state['MemTotal']//1024**3} GiB limit, at least 15 GiB disk free.")
    CONFIG.mkdir(mode=0o700, exist_ok=True)
    parts=shlex.split((PRIVATE/'zetaris-registry-command.txt').read_text(encoding='utf-8').strip())
    if len(parts)!=9 or parts[0]!='echo' or parts[2:7]!=['|','docker','login','zetarishackathon.azurecr.io','-u'] or parts[8]!='--password-stdin' or not re.fullmatch(r'[A-Za-z0-9_.@-]+',parts[7]):
        raise SystemExit('Unexpected registry command format; nothing executed.')
    login=subprocess.run(BASE+['login','zetarishackathon.azurecr.io','--username',parts[7],'--password-stdin'],input=parts[1]+'\n',capture_output=True,text=True,timeout=60)
    if login.returncode:
        raise SystemExit('Registry login failed. Credentials were not printed.')
    print('Official registry login succeeded; authentication stored only in ignored .runtime/docker-config.')
    credentials=PRIVATE/'zetaris-local-admin.json'
    if not credentials.exists():
        values={'email':'admin@zetaris.com','password':'Fc!7'+secrets.token_hex(18),'postgresPassword':'Pg!8'+secrets.token_hex(18)}
        credentials.write_text(json.dumps(values),encoding='utf-8')
        env_path=BUNDLE/'.env'
        env=env_path.read_text(encoding='utf-8')
        for key,value in {'ZETARIS_ADMIN_PASSWORD':values['password'],'POSTGRES_PASSWORD':values['postgresPassword'],'UI_PORT':'127.0.0.1:3000','TELEMETRY_ENABLED':'false'}.items():
            if re.search(r'^'+key+r'=',env,re.M):
                env=re.sub(r'^'+key+r'=.*$',lambda m: key+'='+value,env,flags=re.M)
            else:
                env+='\n'+key+'='+value+'\n'
        env_path.write_text(env,encoding='utf-8')
        print('First-run local credentials prepared. UI is loopback-only; optional telemetry disabled.')
    print('Ready for compose --project-name fechamento-claro-zetaris pull/up. No existing volumes were adopted.')

if __name__=='__main__':
    main()

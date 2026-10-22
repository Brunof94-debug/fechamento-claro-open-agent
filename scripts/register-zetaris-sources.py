"""Register this project's staged CSV sources through the official JDBC driver.

The REST SELECT endpoint intentionally rejects DDL. This uses the full JDBC
contract documented in the licensed platform README instead of inventing a REST
administration route. Credentials stay in this process and are never printed.
"""
import json, pathlib, re, sys, time
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools/python-jdbc'))
import jpype

def main():
    staged_path=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'.runtime/demo-staged.json'
    staged=json.loads(staged_path.read_text(encoding='utf-8'))
    credentials=json.loads((ROOT/'.runtime/zetaris-local-admin.json').read_text(encoding='utf-8'))
    jvms=list((ROOT/'.tools/temurin-jre').rglob('jvm.dll'))
    jars=list((ROOT/'.runtime/zetaris/zetaris-platform/jdbc').glob('*driver.jar'))
    if len(jvms)!=1 or len(jars)!=1:raise RuntimeError('Expected one verified portable JVM and one official JDBC driver.')
    jpype.startJVM(str(jvms[0]),classpath=[str(jars[0])])
    jpype.JClass('com.zetaris.lightning.jdbc.LightningDriver')
    conn=jpype.JClass('java.sql.DriverManager').getConnection('jdbc:zetaris:lightning@localhost:10000',credentials['email'],credentials['password'])
    receipts=[]
    try:
        for kind,table in staged['tables'].items():
            if not re.fullmatch(r'fc_[a-f0-9]{32}_(orders|settlements|refunds)',table['name']):raise ValueError('Unexpected table name.')
            if not re.fullmatch(r'/home/zetaris/customer-data/shared/fechamento/fc_[a-f0-9]{32}/(orders|settlements|refunds)\.csv',table['path']):raise ValueError('Unexpected source path.')
            sql=f'CREATE LIGHTNING FILESTORE TABLE {table["name"]} FROM FECHAMENTO_CLARO FORMAT CSV OPTIONS (path "{table["path"]}", header "true", inferSchema "false", mode "FAILFAST")'
            statement=conn.createStatement();start=time.monotonic()
            try:
                # A registered table must be queryable by its qualified catalog name.
                try:
                    probe=statement.executeQuery(f"SELECT * FROM FECHAMENTO_CLARO.{table['name']} LIMIT 1")
                    probe.close()
                    action='existing registered source'
                except Exception as error:
                    if not any(code in str(error) for code in ['Not exist','Notexist','TABLE_OR_VIEW_NOT_FOUND']):raise
                    statement.execute(sql)
                    action='registered new source'
                receipts.append({'table':table['name'],'sql':sql,'method':'official Zetaris JDBC','elapsedMs':round((time.monotonic()-start)*1000),'completed':True,'action':action})
                print('Registered',kind,flush=True)
            finally:statement.close()
        target=ROOT/'.runtime'/f"{staged['run']}-registration.json"
        target.write_text(json.dumps(receipts,indent=2),encoding='utf-8')
        def query(sql):
            statement=conn.createStatement();start=time.monotonic()
            try:
                result=statement.executeQuery(sql);meta=result.getMetaData();records=[]
                while result.next():
                    if len(records)>=5000:raise ValueError('Query exceeds the supported close size.')
                    records.append({str(meta.getColumnLabel(i)):None if result.getString(i) is None else str(result.getString(i)) for i in range(1,meta.getColumnCount()+1)})
                receipts.append({'sql':sql,'method':'official Zetaris JDBC','elapsedMs':round((time.monotonic()-start)*1000),'rows':len(records),'completed':True})
                return records
            finally:statement.close()
        sources={kind:query(f"SELECT * FROM FECHAMENTO_CLARO.{table['name']} ORDER BY CAST(source_line AS INT)") for kind,table in staged['tables'].items()}
        joined=query(staged['crossSourceSQL']) if staged.get('crossSourceSQL') else []
        (ROOT/'.runtime'/f"{staged['run']}-query-results.json").write_text(json.dumps({'sources':sources,'joined':joined,'receipts':receipts},indent=2),encoding='utf-8')
        print('Read source snapshots and cross-source totals through Zetaris JDBC.',flush=True)
    finally:
        conn.close()

if __name__=='__main__':
    try:main()
    except Exception as error:
        message=str(error)
        try:
            c=json.loads((ROOT/'.runtime/zetaris-local-admin.json').read_text(encoding='utf-8'))
            for value in c.values():message=message.replace(str(value),'[redacted]')
        except Exception:pass
        print('Registration failed:',message[:1500],file=sys.stderr)
        sys.exit(1)

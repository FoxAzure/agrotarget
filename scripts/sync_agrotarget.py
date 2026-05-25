# ================================= DOCUMENTATION ------------------------------------------ #
# Script: Sync AgroTarget (SQLite + JSON Inline)
# Purpose: Sincroniza API com SQLite, impede duplicidade por DATA_ATUALIZACAO, mantém 50 dias e exporta 25.
# Relationships: tb_AgroTarget (SQLite dinâmico)
# ================================= VARIABLES ---------------------------------------------- #
ENABLE_API = True
API_URL = "https://script.google.com/macros/s/AKfycbxXfBE-x9Opx4KOkPbT2eWOnObwUvIjy1bLODWBs0dHxMdQBeUteoZuP2KRmsQN2vniug/exec"
DB_PATH = "src/data/qualyflow.db"
JSON_OUTPUT = "src/data/mockData.json"
JSON_UPDATE_PATH = "src/data/qualy_update.json"
DIAS_EXPORTACAO = 25
DIAS_MANUTENCAO_BANCO = 50

import requests
import sqlite3
import json
import os
from datetime import datetime, timedelta, timezone

# ================================= HELPERS ------------------------------------------------ #
def get_brasilia_time():
    """ Retorna a data e hora atual cravada no fuso de Brasília (UTC-3) """
    brt_tz = timezone(timedelta(hours=-3))
    return datetime.now(brt_tz).strftime("%Y-%m-%d %H:%M:%S")

def parse_br_date(date_str, is_datetime=False):
    if not date_str:
        return ""
    try:
        if is_datetime:
            d = datetime.strptime(str(date_str).strip(), "%d/%m/%Y %H:%M:%S")
            return d.strftime("%Y-%m-%d %H:%M:%S")
        else:
            d = datetime.strptime(str(date_str).split(" ")[0].strip(), "%d/%m/%Y")
            return d.strftime("%Y-%m-%d")
    except Exception:
        return str(date_str)

def carregar_ultimo_timestamp_gravado():
    if os.path.exists(JSON_UPDATE_PATH):
        try:
            with open(JSON_UPDATE_PATH, 'r', encoding='utf-8') as f:
                info = json.load(f)
                return info.get("DATA_ATUALIZACAO_PLANILHA", "")
        except:
            return ""
    return ""

def setup_database(cursor, sample_row):
    cols = []
    for key in sample_row.keys():
        if key == "ID":
            cols.append("ID INTEGER PRIMARY KEY")
        else:
            cols.append(f'"{key}" TEXT')
    cursor.execute(f"CREATE TABLE IF NOT EXISTS tb_AgroTarget ({', '.join(cols)})")

def format_export_row(row_dict):
    cleaned = {}
    numeric_fields = ['VALOR', 'CODIGO_CAMPO', 'LOTE', 'LATITUDE', 'LONGITUDE', 'EXTRA1'] 
    
    for k, v in row_dict.items():
        if v is None:
            cleaned[k] = ""
        elif isinstance(v, str):
            cleaned[k] = v.strip()
        else:
            cleaned[k] = v

        if k in numeric_fields and cleaned[k] != "":
            try:
                val_str = str(cleaned[k]).replace(',', '.')
                val = float(val_str)
                if val.is_integer():
                    cleaned[k] = int(val)
                else:
                    cleaned[k] = val
            except ValueError:
                pass
                
    return cleaned

# ================================= EXECUTOR ----------------------------------------------- #
def execute():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    dados_novos_processados = False
    timestamp_planilha_atual = ""

    if ENABLE_API:
        print("Umeko conectando à API de Qualidade da Agrovale...")
        try:
            response = requests.get(API_URL, timeout=60)
            response.raise_for_status()
            dados = response.json()
            
            if dados and isinstance(dados, list):
                setup_database(cursor, dados[0])
                
                # Validação inteligente por DATA_ATUALIZACAO do primeiro registro
                timestamp_planilha_atual = parse_br_date(dados[0].get('DATA_ATUALIZACAO', ''), is_datetime=True)
                timestamp_anterior = carregar_ultimo_timestamp_gravado()
                
                print(f"Timestamp API: {timestamp_planilha_atual} | Último Processado: {timestamp_anterior}")
                
                if timestamp_planilha_atual and timestamp_planilha_atual == timestamp_anterior:
                    print("Umeko verificou: Nenhuma modificação recente na API de Qualidade. Pulando inserção.")
                else:
                    colunas = list(dados[0].keys())
                    colunas_str = ", ".join([f'"{c}"' for c in colunas])
                    placeholders = ", ".join(["?"] * len(colunas))
                    update_set = ", ".join([f'"{c}" = excluded."{c}"' for c in colunas if c != 'ID'])
                    
                    sql_upsert = f"""
                        INSERT INTO tb_AgroTarget ({colunas_str})
                        VALUES ({placeholders})
                        ON CONFLICT(ID) DO UPDATE SET
                        {update_set}
                        WHERE excluded.DATA_ATUALIZACAO > tb_AgroTarget.DATA_ATUALIZACAO
                    """
                    
                    for row in dados:
                        row['DATA_APONTAMENTO'] = parse_br_date(row.get('DATA_APONTAMENTO', ''), is_datetime=False)
                        row['DATA_ATUALIZACAO'] = parse_br_date(row.get('DATA_ATUALIZACAO', ''), is_datetime=True)
                        valores = [row.get(c, "") for c in colunas]
                        cursor.execute(sql_upsert, valores)
                    
                    conn.commit()
                    dados_novos_processados = True
                    print("Upsert da Qualidade executado com sucesso!")
            else:
                print("Nenhum dado recebido da API de Qualidade.")
        except Exception as e:
            print(f"Erro na API de Qualidade: {e}")
    else:
        print("Umeko informa: API desativada. Usando apenas a base local do SQLite.")

    # --- FAXINA INTELIGENTE (Mantém apenas as últimas 50 datas com dados) ---
    print("Umeko fazendo a faxina cirúrgica no banco de dados...")
    try:
        cursor.execute("""
            SELECT DISTINCT DATA_APONTAMENTO FROM tb_AgroTarget 
            WHERE DATA_APONTAMENTO != '' AND DATA_APONTAMENTO IS NOT NULL
            ORDER BY DATA_APONTAMENTO DESC 
            LIMIT ?
        """, (DIAS_MANUTENCAO_BANCO,))
        
        datas_para_manter = [row[0] for row in cursor.fetchall()]
        
        if datas_para_manter:
            placeholders_keep = ", ".join(["?"] * len(datas_para_manter))
            sql_delete = f"""
                DELETE FROM tb_AgroTarget 
                WHERE DATA_APONTAMENTO NOT IN ({placeholders_keep}) 
                  AND DATA_APONTAMENTO != '' 
                  AND DATA_APONTAMENTO IS NOT NULL
            """
            cursor.execute(sql_delete, datas_para_manter)
            conn.commit()
            cursor.execute("VACUUM")
            print(f"Faxina terminada! Mantivemos apenas os registros vinculados às {len(datas_para_manter)} últimas datas reais.")
    except Exception as e:
        print(f"Aviso na limpeza do banco: {e}")

    # --- EXPORTAÇÃO DOS 25 DIAS TRABALHADOS PARA O JSON ---
    print(f"Filtrando os últimos {DIAS_EXPORTACAO} dias de apontamento para gerar o JSON...")
    cursor.execute("""
        SELECT DISTINCT DATA_APONTAMENTO FROM tb_AgroTarget 
        WHERE DATA_APONTAMENTO != '' AND DATA_APONTAMENTO IS NOT NULL
        ORDER BY DATA_APONTAMENTO DESC 
        LIMIT ?
    """, (DIAS_EXPORTACAO,))
    
    datas_json = [row[0] for row in cursor.fetchall()]
    
    rows_export = []
    if datas_json:
        cursor.execute("SELECT * FROM tb_AgroTarget")
        col_names = [description[0] for description in cursor.description]
        all_rows = cursor.fetchall()
        
        for row in all_rows:
            row_dict = dict(zip(col_names, row))
            if row_dict.get('DATA_APONTAMENTO') in datas_json:
                rows_export.append(format_export_row(row_dict))

    # Escreve o arquivo formatado inline
    with open(JSON_OUTPUT, 'w', encoding='utf-8') as f:
        f.write("[\n")
        for i, entry in enumerate(rows_export):
            line = json.dumps(entry, ensure_ascii=False, separators=(',', ':'))
            f.write(f"  {line}")
            if i < len(rows_export) - 1:
                f.write(",\n")
            else:
                f.write("\n")
        f.write("]")

    # Atualiza o arquivo de status se novos dados foram injetados ou se ele não existia
    if dados_novos_processados or not os.path.exists(JSON_UPDATE_PATH):
        update_info = {
            "DATA_HORA": get_brasilia_time(),
            "DATA_ATUALIZACAO_PLANILHA": timestamp_planilha_atual if timestamp_planilha_atual else get_brasilia_time()
        }
        with open(JSON_UPDATE_PATH, 'w', encoding='utf-8') as f:
            json.dump(update_info, f, ensure_ascii=False, indent=2)
        print(f"Status da Qualidade atualizado: {update_info['DATA_HORA']}")

    conn.close()
    print(f"Processo concluído. {len(rows_export)} linhas exportadas para o JSON.")

if __name__ == "__main__":
    execute()
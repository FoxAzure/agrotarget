# ================================= DOCUMENTATION ------------------------------------------ #
# Script: Sync AgroTarget (SQLite + JSON Inline)
# Purpose: Sincroniza API com SQLite mantendo datas em DD/MM/AAAA, filtra dias via Python e exporta.
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
    """ Retorna a data e hora atual cravada no fuso de Brasília (UTC-3) no formato BR """
    brt_tz = timezone(timedelta(hours=-3))
    return datetime.now(brt_tz).strftime("%d/%m/%Y %H:%M:%S")

def parse_br_date(date_str, is_datetime=False):
    """ Garante que a string que vai para o banco fique no formato BR puro (DD/MM/AAAA) """
    if not date_str:
        return ""
    try:
        date_clean = str(date_str).strip()
        if is_datetime:
            if "-" in date_clean and "T" not in date_clean:
                d = datetime.strptime(date_clean, "%Y-%m-%d %H:%M:%S")
                return d.strftime("%d/%m/%Y %H:%M:%S")
            elif "T" in date_clean:
                d = datetime.strptime(date_clean.split(".")[0], "%Y-%m-%dT%H:%M:%S")
                return d.strftime("%d/%m/%Y %H:%M:%S")
        else:
            date_only = date_clean.split(" ")[0].split("T")[0]
            if "-" in date_only:
                d = datetime.strptime(date_only, "%Y-%m-%d")
                return d.strftime("%d/%m/%Y")
    except Exception:
        pass
    return str(date_str).strip()

def get_valid_date(date_str):
    """ Converte a string do banco em um objeto datetime apenas para ordenação na memória """
    if not date_str:
        return None
    try:
        date_clean = str(date_str).split(" ")[0].strip()
        if "-" in date_clean:
            return datetime.strptime(date_clean, "%Y-%m-%d")
        else:
            return datetime.strptime(date_clean, "%d/%m/%Y")
    except:
        return None

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

    # --- FAXINA INTELIGENTE (Tratando as strings na memória) ---
    print("Umeko fazendo a faxina cirúrgica no banco de dados...")
    try:
        cursor.execute("SELECT DISTINCT DATA_APONTAMENTO FROM tb_AgroTarget WHERE DATA_APONTAMENTO != '' AND DATA_APONTAMENTO IS NOT NULL")
        datas_banco = cursor.fetchall()
        
        datas_validas = []
        for d in datas_banco:
            dt_obj = get_valid_date(d[0])
            if dt_obj:
                datas_validas.append((dt_obj, d[0]))
                
        # Ordenadas da mais recente para a mais antiga (usando o objeto temporal real)
        datas_validas.sort(key=lambda x: x[0], reverse=True)
        
        # Mantém 50 dias no banco de forma segura
        if len(datas_validas) > DIAS_MANUTENCAO_BANCO:
            datas_para_excluir = [d[1] for d in datas_validas[DIAS_MANUTENCAO_BANCO:]]
            placeholders_del = ", ".join(["?"] * len(datas_para_excluir))
            cursor.execute(f"DELETE FROM tb_AgroTarget WHERE DATA_APONTAMENTO IN ({placeholders_del})", datas_para_excluir)
            conn.commit()
            cursor.execute("VACUUM")
            print(f"Faxina terminada! {len(datas_para_excluir)} datas antigas varridas do mapa.")
    except Exception as e:
        print(f"Aviso na limpeza do banco: {e}")

    # --- EXPORTAÇÃO DOS 25 DIAS TRABALHADOS PARA O JSON ---
    print(f"Filtrando os últimos {DIAS_EXPORTACAO} dias de apontamento para gerar o JSON...")
    
    # Pegamos os top 25 a partir da lista já tratada e ordenada na memória
    datas_json = [d[1] for d in datas_validas[:DIAS_EXPORTACAO]]
    
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

    # Atualiza o arquivo de status 
    if dados_novos_processados or not os.path.exists(JSON_UPDATE_PATH):
        update_info = {
            "DATA_HORA": get_brasilia_time(),
            "DATA_ATUALIZACAO_PLANILHA": timestamp_planilha_atual if timestamp_planilha_atual else get_brasilia_time()
        }
        with open(JSON_UPDATE_PATH, 'w', encoding='utf-8') as f:
            json.dump(update_info, f, ensure_ascii=False, indent=2)
        print(f"Status da Qualidade atualizado: {update_info['DATA_HORA']}")

    conn.close()
    print(f"Processo concluído. {len(rows_export)} linhas com o seu padrão de data exportadas para o JSON.")

if __name__ == "__main__":
    execute()
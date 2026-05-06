# ================================= DOCUMENTATION ------------------------------------------ #
# Script: Sync AgroTarget (SQLite + JSON Inline)
# Purpose: Sincroniza API com SQLite, trata números BR, exporta JSON (últimas 40 datas trabalhadas) e gera status.
# Relationships: tb_AgroTarget (SQLite dinâmico)
# ================================= VARIABLES ---------------------------------------------- #
ENABLE_API = False  # Mude para True quando quiser voltar a usar a API do Google
API_URL = "https://script.google.com/macros/s/AKfycbxXfBE-x9Opx4KOkPbT2eWOnObwUvIjy1bLODWBs0dHxMdQBeUteoZuP2KRmsQN2vniug/exec"
DB_PATH = "src/data/qualyflow.db"
JSON_OUTPUT = "src/data/mockData.json"
JSON_UPDATE_PATH = "src/data/qualy_update.json"
DIAS_EXPORTACAO = 40

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
            d = datetime.strptime(str(date_str), "%d/%m/%Y %H:%M:%S")
            return d.strftime("%Y-%m-%d %H:%M:%S")
        else:
            d = datetime.strptime(str(date_str).split(" ")[0], "%d/%m/%Y")
            return d.strftime("%Y-%m-%d")
    except Exception:
        return str(date_str)

def get_valid_date(date_str):
    if not date_str:
        return None
    try:
        if "-" in str(date_str):
            return datetime.strptime(str(date_str).split(" ")[0], "%Y-%m-%d")
        else:
            return datetime.strptime(str(date_str).split(" ")[0], "%d/%m/%Y")
    except:
        return None

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

    if ENABLE_API:
        print("Umeko conectando à API Agrovale...")
        try:
            response = requests.get(API_URL, timeout=60)
            dados = response.json()
            if dados:
                setup_database(cursor, dados[0])
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
                print("Upsert concluído!")
        except Exception as e:
            print(f"Erro na API: {e}")
    else:
        print("Umeko informa: API desativada. Trabalhando apenas com o SQLite local.")

    print("Umeko fazendo a faxina no banco de dados...")
    cursor.execute("SELECT DISTINCT DATA_APONTAMENTO FROM tb_AgroTarget")
    datas_banco = cursor.fetchall()
    
    datas_validas = []
    for d in datas_banco:
        dt_obj = get_valid_date(d[0])
        if dt_obj:
            datas_validas.append((dt_obj, d[0]))
            
    # Ordenadas da mais recente (índice 0) para a mais antiga
    datas_validas.sort(key=lambda x: x[0], reverse=True)
    
    if len(datas_validas) > 50:
        datas_para_excluir = [d[1] for d in datas_validas[50:]]
        placeholders_del = ", ".join(["?"] * len(datas_para_excluir))
        
        cursor.execute(f"DELETE FROM tb_AgroTarget WHERE DATA_APONTAMENTO IN ({placeholders_del})", datas_para_excluir)
        
        conn.commit()
        cursor.execute("VACUUM")
        
        print(f"Faxina concluída e arquivo compactado! Registros de {len(datas_para_excluir)} datas antigas foram varridos do mapa.")
    else:
        conn.commit()
        cursor.execute("VACUUM")
        print("O banco está fininho! Menos de 50 datas cadastradas, mas dei uma compactada de segurança.")

    print(f"Filtrando as últimas {DIAS_EXPORTACAO} datas trabalhadas para o dashboard...")
    
    # ================= LÓGICA DE CORTE POR DATAS TRABALHADAS =================
    if len(datas_validas) > 0:
        # Pega a 40ª data da lista (ou a última, se tiver menos de 40 no banco)
        idx_corte = min(DIAS_EXPORTACAO, len(datas_validas)) - 1
        limite_data_obj = datas_validas[idx_corte][0]
    else:
        # Fallback caso o banco esteja literalmente vazio
        limite_data_obj = datetime.now() - timedelta(days=DIAS_EXPORTACAO)
    # =========================================================================

    cursor.execute("SELECT * FROM tb_AgroTarget")
    col_names = [description[0] for description in cursor.description]
    all_rows = cursor.fetchall()
    
    rows_export = []
    for row in all_rows:
        row_dict = dict(zip(col_names, row))
        data_apontamento = get_valid_date(row_dict.get('DATA_APONTAMENTO', ''))
        
        # Só entra se a data de apontamento for maior ou igual à nossa 40ª data trabalhada
        if data_apontamento and data_apontamento >= limite_data_obj:
            cleaned_row = format_export_row(row_dict)
            rows_export.append(cleaned_row)

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

    update_info = {
        "DATA_HORA": get_brasilia_time()
    }
    with open(JSON_UPDATE_PATH, 'w', encoding='utf-8') as f:
        json.dump(update_info, f, ensure_ascii=False, indent=2)

    conn.commit()
    conn.close()
    
    print(f"Pronto! {len(rows_export)} linhas compactadas, tratadas e salvas em {JSON_OUTPUT}.")
    print(f"Status de atualização salvo em {JSON_UPDATE_PATH} -> {update_info['DATA_HORA']}")

if __name__ == "__main__":
    execute()
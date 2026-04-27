# ================================= DOCUMENTATION ------------------------------------------
# Script: Atualizador de Dados COA Automático
# Purpose: Consumir API do Google Sheets e sobrescrever mockData_coa.json e coa_update.json.
# Relationships: N/A
# ================================= VARIABLES ----------------------------------------------
API_URL = "https://script.google.com/macros/s/AKfycbzeSY1ucF_UNQoS8StW42RWMshyj0MtpsMv_fMNdQxgxszvlW0-11z-EKzSwI5Ivg/exec"
JSON_DATA_PATH = "src/data/mockData_coa.json"
JSON_UPDATE_PATH = "src/data/coa_update.json"

# ================================= HELPERS ------------------------------------------------
import requests
import json
import os
from datetime import datetime, timezone, timedelta

def get_brasilia_time():
    """ Retorna a data e hora atual cravada no fuso de Brasília (UTC-3) """
    brt_tz = timezone(timedelta(hours=-3))
    return datetime.now(brt_tz).strftime("%Y-%m-%d %H:%M:%S")

# ================================= EXECUTOR -----------------------------------------------
def execute():
    print("Iniciando busca de dados na API da Agrovale...")
    try:
        response = requests.get(API_URL, timeout=60)
        response.raise_for_status()
        dados = response.json()
        
        # Garante que as pastas existam
        os.makedirs(os.path.dirname(JSON_DATA_PATH), exist_ok=True)
        
        # 1. Salva o mock data no mesmo formato estruturado do seu PyQt
        with open(JSON_DATA_PATH, 'w', encoding='utf-8') as f:
            f.write("[\n")
            for i, entry in enumerate(dados):
                line = json.dumps(entry, ensure_ascii=False, separators=(',', ':'))
                f.write(f"  {line}")
                if i < len(dados) - 1:
                    f.write(",")
                f.write("\n")
            f.write("]")
            
        print(f"Sucesso! {len(dados)} registros injetados em {JSON_DATA_PATH}")

        # 2. Salva o status de atualização para o App ler
        update_info = {
            "DATA_HORA": get_brasilia_time()
        }
        with open(JSON_UPDATE_PATH, 'w', encoding='utf-8') as f:
            json.dump(update_info, f, ensure_ascii=False, indent=2)
            
        print(f"Atualizado: {update_info['DATA_HORA']}")

    except Exception as e:
        print(f"Erro: {e}")
        raise

if __name__ == "__main__":
    execute()
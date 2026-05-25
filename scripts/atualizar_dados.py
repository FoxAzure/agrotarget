# ================================= DOCUMENTATION ------------------------------------------ #
# Script: Atualizador de Dados COA Automático
# Purpose: Consumir API do Google Sheets, validar novidade pela coluna DATA e sobrescrever JSONs.
# Relationships: N/A
# ================================= VARIABLES ---------------------------------------------- #
API_URL = "https://script.google.com/macros/s/AKfycbzeSY1ucF_UNQoS8StW42RWMshyj0MtpsMv_fMNdQxgxszvlW0-11z-EKzSwI5Ivg/exec"
JSON_DATA_PATH = "src/data/mockData_coa.json"
JSON_UPDATE_PATH = "src/data/coa_update.json"

import requests
import json
import os
from datetime import datetime, timezone, timedelta

# ================================= HELPERS ------------------------------------------------ #
def get_brasilia_time():
    """ Retorna a data e hora atual cravada no fuso de Brasília (UTC-3) """
    brt_tz = timezone(timedelta(hours=-3))
    return datetime.now(brt_tz).strftime("%Y-%m-%d %H:%M:%S")

def carregar_ultima_data_gravada():
    """ Carrega a última data de planilha que foi processada com sucesso """
    if os.path.exists(JSON_UPDATE_PATH):
        try:
            with open(JSON_UPDATE_PATH, 'r', encoding='utf-8') as f:
                info = json.load(f)
                return info.get("DATA_PLANILHA", "")
        except:
            return ""
    return ""

# ================================= EXECUTOR ----------------------------------------------- #
def execute():
    print("Iniciando busca de dados na API da Agrovale para o COA...")
    try:
        response = requests.get(API_URL, timeout=60)
        response.raise_for_status()
        dados = response.json()
        
        if not dados or not isinstance(dados, list):
            print("A API respondeu, mas não trouxe uma lista de dados válida.")
            return

        # Pega a data do primeiro registro como referência da planilha
        data_planilha_atual = dados[0].get("DATA", "")
        data_gravada_anterior = carregar_ultima_data_gravada()

        print(f"Data na Planilha: {data_planilha_atual} | Última Processada: {data_gravada_anterior}")

        if data_planilha_atual and data_planilha_atual == data_gravada_anterior:
            print("Umeko avisa: Os dados da planilha ainda são os mesmos. Nada para atualizar por aqui!")
            return

        # Se mudou, vamos atualizar!
        os.makedirs(os.path.dirname(JSON_DATA_PATH), exist_ok=True)
        
        # 1. Salva o mock data estruturado inline
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

        # 2. Salva o status de atualização incluindo a DATA da planilha
        update_info = {
            "DATA_HORA": get_brasilia_time(),
            "DATA_PLANILHA": data_planilha_atual
        }
        with open(JSON_UPDATE_PATH, 'w', encoding='utf-8') as f:
            json.dump(update_info, f, ensure_ascii=False, indent=2)
            
        print(f"Atualizado status do COA: {update_info['DATA_HORA']}")

    except Exception as e:
        print(f"Erro no processamento do COA: {e}")
        raise

if __name__ == "__main__":
    execute()
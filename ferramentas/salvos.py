# -*- coding: utf-8 -*-
# =========================================================
# Traz os posts SALVOS do Instagram da Mari para o Laboratório criativo.
# Roda no computador dela (Mac), com a internet dela, usando o Instaloader.
# - Pergunta o usuário e a senha do Instagram aqui no Terminal (a senha não
#   aparece na tela, não é salva em arquivo e não vai para lugar nenhum além
#   do próprio Instagram).
# - Lê a lista de salvos devagar (com pausas) para o Instagram não estranhar.
# - Grava "salvos_instagram.json" na Mesa (Desktop): link, perfil, tipo, legenda e a
#   PASTA (coleção) de cada post, por exemplo "Gravar em outubro" e "Produzir vídeos assim".
#   Esse arquivo vai no Laboratório criativo > "Enviar arquivo dos salvos" e as pastas
#   aparecem no Painel de conteúdo.
# Nada de foto ou vídeo é baixado.
# =========================================================
import getpass, json, os, random, sys, time

try:
    import instaloader
except ImportError:
    print("Instalando o Instaloader (só na primeira vez)...")
    os.system(f'"{sys.executable}" -m pip install --user --quiet instaloader')
    import instaloader

LIMITE = 2000  # no máximo isso de salvos por vez

def main():
    print("\n=== Salvos do Instagram para o Laboratório criativo ===\n")
    usuario = input("Seu usuário do Instagram [maribonettougc]: ").strip().lstrip("@") or "maribonettougc"
    L = instaloader.Instaloader(quiet=True, download_pictures=False, download_videos=False,
                                download_video_thumbnails=False, save_metadata=False, compress_json=False)
    sessao = os.path.expanduser(f"~/.instaloader-sessao-{usuario}")
    try:
        L.load_session_from_file(usuario, sessao)
        print("Usando o login que já estava salvo neste computador.")
    except FileNotFoundError:
        senha = getpass.getpass("Sua senha do Instagram (não aparece enquanto digita): ")
        try:
            L.login(usuario, senha)
        except instaloader.TwoFactorAuthRequiredException:
            codigo = input("Código de verificação em duas etapas (SMS ou app): ").strip()
            L.two_factor_login(codigo)
        except instaloader.BadCredentialsException:
            print("\nUsuário ou senha errados. Rode de novo.")
            return
        except instaloader.ConnectionException as e:
            print("\nO Instagram pediu confirmação. Abra o app do Instagram, confirme que foi você e rode de novo.\n", e)
            return
        L.save_session_to_file(sessao)  # guarda só o login (não a senha) para não pedir de novo

    saida, vistos = [], {}

    def guardar(codigo, tipo_num, produto, dono, legenda, data, colecao):
        tipo = "Reel" if (tipo_num == 2 or produto == "clips") else ("Carrossel" if tipo_num == 8 else "Post")
        caminho = "reel" if tipo == "Reel" else "p"
        if codigo in vistos:
            if colecao and not saida[vistos[codigo]].get("colecao"):
                saida[vistos[codigo]]["colecao"] = colecao
            return
        vistos[codigo] = len(saida)
        saida.append({"link": f"https://www.instagram.com/{caminho}/{codigo}/", "codigo": codigo, "perfil": dono,
                      "tipo": tipo, "legenda": (legenda or "")[:4000], "publicado_em": data, "colecao": colecao})

    # 1) as pastas (coleções) dos salvos
    try:
        cols = L.context.get_iphone_json("api/v1/collections/list/", {"collection_types": '["MEDIA"]'})
        colecoes = [(c.get("collection_id"), c.get("collection_name")) for c in cols.get("items", []) if c.get("collection_id")]
    except Exception as e:
        print("Não consegui ler as pastas dos salvos (vou trazer todos sem pasta):", e)
        colecoes = []
    if colecoes:
        print("Pastas encontradas: " + ", ".join(n for _, n in colecoes))
    for cid, nome in colecoes:
        print(f"\nLendo a pasta \"{nome}\"...")
        max_id, paginas = None, 0
        try:
            while paginas < 40:
                params = {"max_id": max_id} if max_id else {}
                r = L.context.get_iphone_json(f"api/v1/feed/collection/{cid}/posts/", params)
                for it in r.get("items", []):
                    m = it.get("media") or it
                    cap = (m.get("caption") or {}).get("text") if isinstance(m.get("caption"), dict) else None
                    data = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(m.get("taken_at", 0))) if m.get("taken_at") else None
                    guardar(m.get("code"), m.get("media_type"), m.get("product_type"), (m.get("user") or {}).get("username"), cap, data, nome)
                paginas += 1
                print(f"  {len(saida)} salvos lidos...")
                if not r.get("more_available") or not r.get("next_max_id"):
                    break
                max_id = r.get("next_max_id")
                time.sleep(random.uniform(2.5, 5))
        except Exception as e:
            print(f"  O Instagram interrompeu a pasta \"{nome}\". Vou seguir com o que já li.", e)
        time.sleep(random.uniform(3, 6))

    # 2) o resto dos salvos (sem pasta)
    perfil = instaloader.Profile.own_profile(L.context)
    print("\nLendo os outros salvos (vai devagar de propósito)...")
    try:
        for i, post in enumerate(perfil.get_saved_posts()):
            if i >= LIMITE:
                break
            guardar(post.shortcode, 2 if post.is_video else (8 if post.typename == "GraphSidecar" else 1), None,
                    post.owner_username, post.caption, post.date_utc.isoformat() + "Z", None)
            if len(saida) % 12 == 0:
                print(f"  {len(saida)} salvos lidos...")
                time.sleep(random.uniform(2.5, 5))
    except KeyboardInterrupt:
        print("\nParado por você. Vou gravar o que já li.")
    except Exception as e:
        print("\nO Instagram interrompeu a leitura (normal se tiver muitos salvos). Vou gravar o que já li.\n", e)

    mesa = os.path.expanduser("~/Desktop")
    arquivo = os.path.join(mesa if os.path.isdir(mesa) else os.path.expanduser("~"), "salvos_instagram.json")
    with open(arquivo, "w", encoding="utf-8") as f:
        json.dump({"origem": "instaloader", "usuario": usuario, "pastas": [n for _, n in colecoes], "salvos": saida}, f, ensure_ascii=False, indent=1)
    print(f"\nPronto! {len(saida)} salvos em: {arquivo}")
    print("Agora abra o painel > Criatividade > Laboratório criativo > Enviar arquivo dos salvos.\n")

if __name__ == "__main__":
    main()

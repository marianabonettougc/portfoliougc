# -*- coding: utf-8 -*-
# =========================================================
# Traz os posts SALVOS do Instagram da Mari para o Laboratório criativo.
# Roda no computador dela (Mac), com a internet dela, usando o Instaloader.
# - Pergunta o usuário e a senha do Instagram aqui no Terminal (a senha não
#   aparece na tela, não é salva em arquivo e não vai para lugar nenhum além
#   do próprio Instagram).
# - Lê a lista de salvos devagar (com pausas) para o Instagram não estranhar.
# - Grava "salvos_instagram.json" na Mesa (Desktop): link, perfil, tipo e legenda
#   de cada post. Esse arquivo vai no Laboratório criativo > "Enviar arquivo dos salvos".
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

    perfil = instaloader.Profile.own_profile(L.context)
    saida, vistos = [], set()
    print("\nLendo seus salvos (vai devagar de propósito)...")
    try:
        for i, post in enumerate(perfil.get_saved_posts()):
            if i >= LIMITE:
                break
            if post.shortcode in vistos:
                continue
            vistos.add(post.shortcode)
            tipo = "Reel" if post.is_video else ("Carrossel" if post.typename == "GraphSidecar" else "Post")
            caminho = "reel" if post.is_video else "p"
            saida.append({
                "link": f"https://www.instagram.com/{caminho}/{post.shortcode}/",
                "codigo": post.shortcode,
                "perfil": post.owner_username,
                "tipo": tipo,
                "legenda": (post.caption or "")[:4000],
                "publicado_em": post.date_utc.isoformat() + "Z",
            })
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
        json.dump({"origem": "instaloader", "usuario": usuario, "salvos": saida}, f, ensure_ascii=False, indent=1)
    print(f"\nPronto! {len(saida)} salvos em: {arquivo}")
    print("Agora abra o painel > Criatividade > Laboratório criativo > Enviar arquivo dos salvos.\n")

if __name__ == "__main__":
    main()
